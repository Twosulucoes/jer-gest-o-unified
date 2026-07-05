import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Search, RotateCcw, Package, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useEventContext } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import PwaLayout from "@/components/pwa/PwaLayout";
import { cn } from "@/lib/utils";

interface MaterialKit {
  id: string;
  name: string;
}

interface DeliveryRow {
  id: string;
  delivered_at: string;
  method: string;
  full_name: string;
  cpf: string | null;
  participant_type: string | null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MaterialListaPage() {
  const { activeEventId } = useEventContext();
  const stageId = useActiveStageId();

  usePwaAudit("material/lista", activeEventId);

  const [kits, setKits] = useState<MaterialKit[]>([]);
  const [kitId, setKitId] = useState("");
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeEventId) return;
    (async () => {
      let q = (supabase as any)
        .from("material_kits")
        .select("id, name")
        .eq("event_id", activeEventId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (stageId) q = q.eq("event_stage_id", stageId);
      const { data } = await q;
      const list = (data ?? []) as MaterialKit[];
      setKits(list);
      if (list.length > 0 && !list.some((k) => k.id === kitId)) {
        setKitId(list[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId, stageId]);

  const fetchRows = useCallback(async () => {
    if (!kitId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("material_deliveries")
      .select(
        `id, delivered_at, method,
         participants!inner(participant_type, people!inner(full_name, cpf))`,
      )
      .eq("kit_id", kitId)
      .eq("status", "active")
      .order("delivered_at", { ascending: false });

    const mapped: DeliveryRow[] = ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      delivered_at: r.delivered_at,
      method: r.method,
      full_name: r.participants?.people?.full_name || "",
      cpf: r.participants?.people?.cpf || null,
      participant_type: r.participants?.participant_type || null,
    }));
    setRows(mapped);
    setLoading(false);
  }, [kitId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  // Realtime
  useEffect(() => {
    if (!kitId) return;
    const channel = supabase
      .channel(`material_lista_${kitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "material_deliveries",
          filter: `kit_id=eq.${kitId}`,
        },
        () => void fetchRows(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kitId, fetchRows]);

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Estornar a entrega de "${name}"? A pessoa poderá receber o material novamente.`)) {
      return;
    }
    const { data, error } = await (supabase as any).rpc("revoke_material_delivery", {
      p_delivery_id: id,
      p_reason: "Estorno manual pelo operador",
    });
    if (error) {
      toast.error("Erro ao estornar: " + (error.message || "desconhecido"));
      return;
    }
    const res = data as { ok: boolean; reason?: string };
    if (!res.ok) {
      toast.error("Não foi possível estornar (já estornada?).");
      return;
    }
    toast.success("Entrega estornada.");
    void fetchRows();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) || (r.cpf || "").includes(q),
    );
  }, [rows, query]);

  return (
    <PwaLayout backTo="/pwa/material/scan" moduleTitle="Entregas de Material">
      <main className="relative mx-auto max-w-md space-y-3 p-3">
        {kits.length > 1 && (
          <select
            value={kitId}
            onChange={(e) => setKitId(e.target.value)}
            className="w-full rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 text-sm font-semibold text-foreground"
            aria-label="Selecionar kit"
          >
            {kits.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-module" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {rows.length} entregas
            </span>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 border-border/80 bg-card/90 pl-10 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {kits.length === 0
              ? "Nenhum kit cadastrado para esta etapa."
              : "Nenhuma entrega registrada ainda."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <Card key={r.id} className="border-border/80 bg-card/95">
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs bg-[hsl(var(--module-accent)/0.15)] text-[hsl(var(--module-accent))]">
                      {r.full_name ? getInitials(r.full_name) : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.full_name || "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.participant_type || "—"} ·{" "}
                      {format(new Date(r.delivered_at), "dd/MM HH:mm")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(r.id, r.full_name || "esta pessoa")}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/5",
                      "px-2.5 py-1.5 text-[11px] font-semibold text-destructive active:scale-[0.97] transition-transform",
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Estornar
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </PwaLayout>
  );
}
