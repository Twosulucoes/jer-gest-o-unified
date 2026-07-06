import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { useStageModuleKpis } from "@/contexts/StageModuleKpisContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Package,
  Plus,
  RotateCcw,
  PackageCheck,
  School,
  X,
  Radio,
} from "lucide-react";

interface MaterialKit {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  event_stage_id: string | null;
}

interface DeliveryRow {
  id: string;
  delivered_at: string;
  method: string;
  full_name: string;
  cpf: string | null;
  participant_type: string | null;
  escola: string;
}

const SEM_ESCOLA = "Sem escola/delegação";

interface SchoolProgress {
  escola: string;
  delivered: number;
  total: number | null;
  faltam: number | null;
}

export default function MaterialEntregaPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const eventId = useActiveEventId();
  const { stageId } = useStageScope();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const [kitDialog, setKitDialog] = useState<MaterialKit | "new" | null>(null);
  const [kitName, setKitName] = useState("");
  const [kitDesc, setKitDesc] = useState("");
  const [selectedKitId, setSelectedKitId] = useState<string>("");
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);

  // ── Kits ────────────────────────────────────────────────
  const { data: kits = [], isLoading: loadingKits } = useQuery({
    queryKey: ["material_kits", eventId, stageId],
    enabled: !!eventId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("material_kits")
        .select("id, name, description, is_active, event_stage_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MaterialKit[];
    },
  });

  const activeKitId = selectedKitId || kits.find((k) => k.is_active)?.id || kits[0]?.id || "";

  const saveKit = useMutation({
    mutationFn: async () => {
      const name = kitName.trim();
      if (!name) throw new Error("Informe o nome do kit.");
      const { data: { session } } = await supabase.auth.getSession();
      if (kitDialog === "new") {
        const { error } = await (supabase as any).from("material_kits").insert({
          event_id: eventId,
          event_stage_id: stageId || null,
          name,
          description: kitDesc.trim() || null,
          created_by: session?.user.id ?? null,
        });
        if (error) throw error;
      } else if (kitDialog) {
        const { error } = await (supabase as any)
          .from("material_kits")
          .update({ name, description: kitDesc.trim() || null })
          .eq("id", kitDialog.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_kits", eventId, stageId] });
      toast.success("Kit salvo.");
      setKitDialog(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar kit."),
  });

  const toggleKit = useMutation({
    mutationFn: async (kit: MaterialKit) => {
      const { error } = await (supabase as any)
        .from("material_kits")
        .update({ is_active: !kit.is_active })
        .eq("id", kit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_kits", eventId, stageId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar kit."),
  });

  // ── Entregas do kit selecionado ─────────────────────────
  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ["material_deliveries", activeKitId],
    enabled: !!activeKitId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_deliveries")
        .select(
          `id, delivered_at, method,
           participants!inner(participant_type, people!inner(full_name, cpf), delegations(institutions(name)))`,
        )
        .eq("kit_id", activeKitId)
        .eq("status", "active")
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        delivered_at: r.delivered_at,
        method: r.method,
        full_name: r.participants?.people?.full_name || "",
        cpf: r.participants?.people?.cpf || null,
        participant_type: r.participants?.participant_type || null,
        escola: r.participants?.delegations?.institutions?.name || SEM_ESCOLA,
      })) as DeliveryRow[];
    },
  });

  // Atualização ao vivo: qualquer entrega/estorno neste kit recarrega os dados.
  useEffect(() => {
    if (!activeKitId) return;
    const channel = supabase
      .channel(`admin_material_deliveries_${activeKitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "material_deliveries",
          filter: `kit_id=eq.${activeKitId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["material_deliveries", activeKitId] });
          qc.invalidateQueries({ queryKey: ["material_revoked_count", activeKitId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeKitId, qc]);

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("revoke_material_delivery", {
        p_delivery_id: id,
        p_reason: "Estorno pelo painel administrativo",
      });
      if (error) throw error;
      const res = data as { ok: boolean };
      if (!res.ok) throw new Error("Não foi possível estornar (já estornada?).");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material_deliveries", activeKitId] });
      toast.success("Entrega estornada.");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao estornar."),
  });

  const openNewKit = () => {
    setKitName("");
    setKitDesc("");
    setKitDialog("new");
  };
  const openEditKit = (kit: MaterialKit) => {
    setKitName(kit.name);
    setKitDesc(kit.description || "");
    setKitDialog(kit);
  };

  const totalDelivered = deliveries.length;

  const activeKit = useMemo(
    () => kits.find((k) => k.id === activeKitId) ?? null,
    [kits, activeKitId],
  );

  // Contadores para os KPIs do módulo (substituem o cabeçalho global de credenciais)
  const { data: revokedCount = 0 } = useQuery({
    queryKey: ["material_revoked_count", activeKitId],
    enabled: !!activeKitId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("material_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("kit_id", activeKitId)
        .eq("status", "revoked");
      if (error) throw error;
      return count || 0;
    },
  });

  // Universo de quem deveria receber: participantes credenciados e ativos na etapa.
  const { data: credentialedCount = 0 } = useQuery({
    queryKey: ["material_credentialed_count", eventId, stageId],
    enabled: !!eventId && !!stageId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("participants")
        .select("id, participant_event_stages!inner(event_stage_id, status)", {
          count: "exact",
          head: true,
        })
        .eq("is_active", true)
        .not("credentialed_at", "is", null)
        .eq("participant_event_stages.event_stage_id", stageId)
        .eq("participant_event_stages.status", "active");
      if (error) throw error;
      return count || 0;
    },
  });

  // Universo credenciado quebrado por escola (para o "faltam" por escola).
  const { data: credentialedBySchool = null } = useQuery({
    queryKey: ["material_credentialed_by_school", eventId, stageId],
    enabled: !!eventId && !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("participants")
        .select(
          "id, participant_event_stages!inner(event_stage_id, status), delegations(institutions(name))",
        )
        .eq("is_active", true)
        .not("credentialed_at", "is", null)
        .eq("participant_event_stages.event_stage_id", stageId)
        .eq("participant_event_stages.status", "active");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as any[]) {
        const escola = r.delegations?.institutions?.name || SEM_ESCOLA;
        map.set(escola, (map.get(escola) ?? 0) + 1);
      }
      return map;
    },
  });

  // Consolidação por escola: entregues (do kit) x credenciados (da etapa).
  const schoolProgress = useMemo<SchoolProgress[]>(() => {
    const delivered = new Map<string, number>();
    for (const d of deliveries) {
      delivered.set(d.escola, (delivered.get(d.escola) ?? 0) + 1);
    }

    const escolas = new Set<string>([...delivered.keys()]);
    if (credentialedBySchool) {
      for (const k of credentialedBySchool.keys()) escolas.add(k);
    }

    const rows: SchoolProgress[] = [...escolas].map((escola) => {
      const del = delivered.get(escola) ?? 0;
      const total = credentialedBySchool ? credentialedBySchool.get(escola) ?? 0 : null;
      return {
        escola,
        delivered: del,
        total,
        faltam: total === null ? null : Math.max(0, total - del),
      };
    });

    rows.sort((a, b) => {
      // Com universo conhecido, prioriza quem ainda tem pendências.
      if (a.faltam !== null && b.faltam !== null && b.faltam !== a.faltam) {
        return b.faltam - a.faltam;
      }
      if (b.delivered !== a.delivered) return b.delivered - a.delivered;
      return a.escola.localeCompare(b.escola, "pt-BR");
    });

    return rows;
  }, [deliveries, credentialedBySchool]);

  const filteredDeliveries = useMemo(
    () =>
      schoolFilter
        ? deliveries.filter((d) => d.escola === schoolFilter)
        : deliveries,
    [deliveries, schoolFilter],
  );

  const faltam = Math.max(0, credentialedCount - totalDelivered);

  useStageModuleKpis([
    { label: "Entregues", value: totalDelivered, tone: "success" },
    ...(stageId
      ? [{ label: "Faltam", value: faltam, tone: "warning" as const }]
      : []),
    ...(revokedCount > 0
      ? [{ label: "Estornadas", value: revokedCount, tone: "danger" as const }]
      : []),
  ]);

  return (
    <div className="space-y-4">
      {/* Gestão de Kits */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" /> Kits de Material
          </CardTitle>
          {canWrite && (
            <Button size="sm" onClick={openNewKit}>
              <Plus className="mr-1 h-4 w-4" /> Novo Kit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingKits ? (
            <Skeleton className="h-16 w-full" />
          ) : kits.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum kit cadastrado para esta etapa. Crie um para começar.
            </p>
          ) : (
            kits.map((kit) => (
              <div
                key={kit.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <button
                  type="button"
                  onClick={() => setSelectedKitId(kit.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{kit.name}</p>
                    {kit.id === activeKitId && (
                      <Badge variant="secondary" className="text-[10px]">
                        selecionado
                      </Badge>
                    )}
                    {!kit.is_active && (
                      <Badge variant="outline" className="text-[10px]">
                        inativo
                      </Badge>
                    )}
                  </div>
                  {kit.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {kit.description}
                    </p>
                  )}
                </button>
                {canWrite && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditKit(kit)}
                    >
                      Editar
                    </Button>
                    <Switch
                      checked={kit.is_active}
                      onCheckedChange={() => toggleKit.mutate(kit)}
                      aria-label="Ativar/desativar kit"
                    />
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Acompanhamento por escola */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <School className="h-4 w-4" /> Por Escola
            {activeKit && (
              <span className="text-sm font-normal text-muted-foreground">
                · {activeKit.name}
              </span>
            )}
          </CardTitle>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> ao vivo
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingDeliveries ? (
            <Skeleton className="h-24 w-full" />
          ) : schoolProgress.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma entrega registrada ainda para este kit.
            </p>
          ) : (
            <>
              {!stageId && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Selecione uma etapa para ver o total de credenciados e quantos
                  faltam por escola. Sem etapa, mostramos apenas os entregues.
                </p>
              )}
              {schoolProgress.map((s) => {
                const isFiltered = schoolFilter === s.escola;
                const pct =
                  s.total && s.total > 0
                    ? Math.min(100, Math.round((s.delivered / s.total) * 100))
                    : null;
                return (
                  <button
                    key={s.escola}
                    type="button"
                    onClick={() =>
                      setSchoolFilter(isFiltered ? null : s.escola)
                    }
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isFiltered
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {s.escola}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {s.total !== null
                            ? `${s.delivered}/${s.total}`
                            : `${s.delivered} entregue${s.delivered === 1 ? "" : "s"}`}
                        </Badge>
                        {s.faltam !== null && s.faltam > 0 && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400"
                          >
                            faltam {s.faltam}
                          </Badge>
                        )}
                        {s.faltam === 0 && (
                          <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">
                            completo
                          </Badge>
                        )}
                      </div>
                    </div>
                    {pct !== null && (
                      <Progress value={pct} className="mt-2 h-1.5" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* Relatório de entregas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-4 w-4" /> Entregas
            {activeKit && (
              <span className="text-sm font-normal text-muted-foreground">
                · {activeKit.name}
              </span>
            )}
          </CardTitle>
          {schoolFilter && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => setSchoolFilter(null)}
            >
              <X className="h-3.5 w-3.5" />
              <span className="max-w-[10rem] truncate">{schoolFilter}</span>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingDeliveries ? (
            <Skeleton className="h-24 w-full" />
          ) : filteredDeliveries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {schoolFilter
                ? "Nenhuma entrega desta escola para este kit."
                : "Nenhuma entrega registrada para este kit."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Participante</th>
                    <th className="py-2 pr-2 font-medium">Escola</th>
                    <th className="py-2 pr-2 font-medium">Tipo</th>
                    <th className="py-2 pr-2 font-medium">Data/Hora</th>
                    <th className="py-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <p className="font-medium">{d.full_name || "—"}</p>
                        {d.cpf && (
                          <p className="text-xs text-muted-foreground">{d.cpf}</p>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {d.escola}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {d.participant_type || "—"}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {format(new Date(d.delivered_at), "dd/MM HH:mm")}
                      </td>
                      <td className="py-2 text-right">
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Estornar a entrega de "${d.full_name || "esta pessoa"}"?`,
                                )
                              ) {
                                revoke.mutate(d.id);
                              }
                            }}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Estornar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar/editar kit */}
      <Dialog open={kitDialog !== null} onOpenChange={(o) => !o && setKitDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {kitDialog === "new" ? "Novo Kit de Material" : "Editar Kit"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="kit-name">Nome</Label>
              <Input
                id="kit-name"
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
                placeholder="Ex: Kit do Atleta JER 2026"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kit-desc">Descrição (opcional)</Label>
              <Textarea
                id="kit-desc"
                value={kitDesc}
                onChange={(e) => setKitDesc(e.target.value)}
                placeholder="Ex: Camiseta, sacola e credencial"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKitDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={() => saveKit.mutate()} disabled={saveKit.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
