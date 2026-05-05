import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { useLodgingLocations } from "@/hooks/useLodgingAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bed, Plus, AlertTriangle, History, BedDouble } from "lucide-react";

type ActionKind = "initial" | "restock" | "loss";

interface Inventory {
  id: string;
  location_id: string;
  initial_qty: number;
  current_qty: number;
  notes: string | null;
}

interface Movement {
  id: string;
  location_id: string;
  kind: string;
  qty: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

const KIND_LABEL: Record<string, string> = {
  consume: "Consumo (check-in)",
  return: "Devolução (check-out)",
  lost: "Perda/dano",
  restock: "Reposição",
  adjust: "Ajuste",
};

export default function AlojamentoColchoesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const { stageId, isStageScoped } = useStageScope();
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("alojamento");

  const [actionDialog, setActionDialog] = useState<{ kind: ActionKind; locationId: string; locationName: string } | null>(null);
  const [movementsLocationId, setMovementsLocationId] = useState<string | null>(null);

  const { data: locations = [], isLoading: loadingLocations } = useLodgingLocations(stageId);

  const locationIds = locations.map((l: any) => l.id);

  const { data: inventories = [], isLoading: loadingInv } = useQuery({
    queryKey: ["mattress_inventory", locationIds.join(",")],
    enabled: locationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lodging_mattress_inventory" as any)
        .select("*")
        .in("location_id", locationIds);
      if (error) throw error;
      return (data ?? []) as unknown as Inventory[];
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["mattress_movements", movementsLocationId],
    enabled: !!movementsLocationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lodging_mattress_movements" as any)
        .select("*")
        .eq("location_id", movementsLocationId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Movement[];
    },
  });

  const invByLocation = new Map<string, Inventory>(inventories.map((i) => [i.location_id, i]));

  if (!isStageScoped || !stageId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
        <Bed className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Acesse pelo menu de uma etapa</p>
      </div>
    );
  }

  const isLoading = loadingLocations || loadingInv;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <BedDouble className="h-6 w-6" /> Colchões
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estoque por alojamento. Saldo é atualizado automaticamente em check-in/out;
          reposição e perda são registradas manualmente aqui.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-md" />)}
        </div>
      ) : locations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum alojamento cadastrado nesta etapa.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {locations.map((loc: any) => {
            const inv = invByLocation.get(loc.id);
            const initial = inv?.initial_qty ?? 0;
            const current = inv?.current_qty ?? 0;
            const inUse = Math.max(initial - current, 0);
            const lostBalance = initial - current - inUse; // só fica != 0 se houve perda
            return (
              <Card key={loc.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{loc.name}</CardTitle>
                      {inv?.notes && <p className="text-xs text-muted-foreground mt-1">{inv.notes}</p>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setMovementsLocationId(loc.id)}>
                      <History className="h-3.5 w-3.5 mr-1" /> Histórico
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/30 py-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Estoque inicial</div>
                      <div className="text-lg font-bold">{initial}</div>
                    </div>
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 py-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo atual</div>
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{current}</div>
                    </div>
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 py-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Em uso</div>
                      <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{inUse}</div>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => setActionDialog({ kind: "initial", locationId: loc.id, locationName: loc.name })}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Definir estoque
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => setActionDialog({ kind: "restock", locationId: loc.id, locationName: loc.name })}>
                        + Reposição
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => setActionDialog({ kind: "loss", locationId: loc.id, locationName: loc.name })}>
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Registrar perda
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {actionDialog && (
        <ActionDialog
          {...actionDialog}
          onClose={() => setActionDialog(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["mattress_inventory"] });
            qc.invalidateQueries({ queryKey: ["mattress_movements"] });
            setActionDialog(null);
          }}
        />
      )}

      {movementsLocationId && (
        <Dialog open={true} onOpenChange={(o) => !o && setMovementsLocationId(null)}>
          <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Histórico de colchões</DialogTitle>
              <DialogDescription>
                Últimas 50 movimentações deste alojamento. Negativo = saída, positivo = entrada.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem movimentações ainda.</p>
              ) : movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{KIND_LABEL[m.kind] ?? m.kind}</Badge>
                      <span className={`font-mono text-xs ${m.qty < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {m.qty > 0 ? `+${m.qty}` : m.qty}
                      </span>
                    </div>
                    {m.notes && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{m.notes}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ActionDialog({ kind, locationId, locationName, onClose, onDone }: {
  kind: ActionKind; locationId: string; locationName: string; onClose: () => void; onDone: () => void;
}) {
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [severity, setSeverity] = useState("media");

  const mut = useMutation({
    mutationFn: async () => {
      const n = parseInt(qty, 10);
      if (Number.isNaN(n) || n < 0) throw new Error("Quantidade inválida");
      if (kind === "initial") {
        const { error } = await supabase.rpc("rpc_set_mattress_initial" as any, {
          p_location_id: locationId, p_initial_qty: n, p_notes: notes || null,
        });
        if (error) throw error;
      } else if (kind === "restock") {
        if (n <= 0) throw new Error("Quantidade deve ser maior que zero");
        const { error } = await supabase.rpc("rpc_register_mattress_restock" as any, {
          p_location_id: locationId, p_qty: n, p_notes: notes || null,
        });
        if (error) throw error;
      } else {
        if (n <= 0) throw new Error("Quantidade deve ser maior que zero");
        if (!notes.trim()) throw new Error("Descrição obrigatória");
        const { error } = await supabase.rpc("rpc_register_mattress_loss" as any, {
          p_location_id: locationId, p_qty: n, p_description: notes, p_severity: severity,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(kind === "initial" ? "Estoque definido"
                  : kind === "restock" ? "Reposição registrada"
                  : "Perda registrada");
      onDone();
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const titles = {
    initial: "Definir estoque inicial",
    restock: "Registrar reposição",
    loss: "Registrar perda/dano",
  };
  const descriptions = {
    initial: "Quantidade total de colchões disponíveis nesta unidade ao iniciar a etapa. Pode ser usado também pra ajustar baseline.",
    restock: "Quantidade adicionada agora ao saldo (entrega de fornecedor, transferência de outro alojamento, etc).",
    loss: "Quantidade perdida ou danificada. Gera incidente automático com a descrição informada.",
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{titles[kind]}</DialogTitle>
          <DialogDescription>{locationName} · {descriptions[kind]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="qty">Quantidade</Label>
            <Input id="qty" type="number" min={kind === "initial" ? 0 : 1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          {kind === "loss" && (
            <div>
              <Label>Severidade</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="notes">{kind === "loss" ? "Descrição (obrigatória)" : "Observação (opcional)"}</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder={kind === "loss" ? "Ex: 2 colchões rasgados durante a noite no quarto 12B" : ""} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mut.isPending}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
