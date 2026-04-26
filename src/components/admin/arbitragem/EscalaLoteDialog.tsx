import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { format, parse } from "date-fns";

const ROLE_OPTIONS = [
  { value: "arbitro_principal", label: "Árbitro Principal" },
  { value: "arbitro_auxiliar", label: "Árbitro Auxiliar" },
  { value: "mesario", label: "Mesário" },
  { value: "fiscal", label: "Fiscal" },
  { value: "anotador", label: "Anotador" },
];

interface SelectedMatch {
  id: string;
  label: string;
}

interface OfficialPick {
  user_id: string;
  full_name: string;
  role: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matches: SelectedMatch[];
  onSuccess?: () => void;
}

export function EscalaLoteDialog({ open, onOpenChange, matches, onSuccess }: Props) {
  const { activeEventId } = useEventContext();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [pendingRole, setPendingRole] = useState<string>("arbitro_principal");
  const [picks, setPicks] = useState<OfficialPick[]>([]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ["escala-lote-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${search.trim()}%`)
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addPick = (userId: string, fullName: string) => {
    if (!pendingRole) {
      toast.error("Selecione a função antes de adicionar.");
      return;
    }
    if (picks.some((p) => p.user_id === userId && p.role === pendingRole)) {
      toast.info("Esse oficial já foi adicionado com essa função.");
      return;
    }
    setPicks((prev) => [...prev, { user_id: userId, full_name: fullName, role: pendingRole }]);
    setSearch("");
  };

  const removePick = (idx: number) => {
    setPicks((prev) => prev.filter((_, i) => i !== idx));
  };

  const reset = () => {
    setPicks([]);
    setSearch("");
    setPendingRole("arbitro_principal");
  };

  const totalDesignacoes = useMemo(
    () => picks.length * matches.length,
    [picks.length, matches.length],
  );

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!activeEventId) throw new Error("Evento ativo não encontrado");
      if (matches.length === 0) throw new Error("Selecione ao menos uma partida");
      if (picks.length === 0) throw new Error("Adicione ao menos um oficial");

      const userResp = await supabase.auth.getUser();
      const createdBy = userResp.data.user?.id ?? null;

      const rows = matches.flatMap((m) =>
        picks.map((p) => ({
          match_id: m.id,
          user_id: p.user_id,
          role: p.role,
          event_id: activeEventId,
          created_by: createdBy,
        })),
      );

      // Insert with on_conflict ignore for (match_id, user_id, role) duplicates.
      // Falls back to per-row insert if upsert is not supported by the table constraints.
      const { data, error } = await supabase
        .from("match_user_assignments" as any)
        .upsert(rows, { onConflict: "match_id,user_id,role", ignoreDuplicates: true })
        .select("id");

      if (error) {
        // Fallback: try one-by-one, counting duplicates as skipped.
        let inserted = 0;
        let skipped = 0;
        for (const row of rows) {
          const { error: e } = await supabase
            .from("match_user_assignments" as any)
            .insert(row);
          if (!e) inserted++;
          else if (e.code === "23505") skipped++;
          else throw e;
        }
        return { inserted, skipped, total: rows.length };
      }

      const inserted = (data as any[] | null)?.length ?? 0;
      return { inserted, skipped: rows.length - inserted, total: rows.length };
    },
    onSuccess: (res) => {
      toast.success(
        `Designações aplicadas: ${res.inserted} criada(s)${
          res.skipped > 0 ? `, ${res.skipped} já existia(m)` : ""
        }.`,
      );
      qc.invalidateQueries({ queryKey: ["arb-assignments", activeEventId] });
      qc.invalidateQueries({ queryKey: ["match_user_assignments"] });
      reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: Error) => toast.error("Falha: " + e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Escala em Lote
          </DialogTitle>
          <DialogDescription>
            Designe os mesmos oficiais para todas as partidas selecionadas.
            Designações duplicadas (mesmo oficial e função numa partida) são ignoradas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo das partidas */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Partidas selecionadas
              </Label>
              <Badge variant="secondary">{matches.length}</Badge>
            </div>
            <ScrollArea className="max-h-[120px] pr-2">
              <ul className="space-y-1 text-sm">
                {matches.length === 0 ? (
                  <li className="text-muted-foreground italic">
                    Nenhuma partida selecionada.
                  </li>
                ) : (
                  matches.map((m) => (
                    <li key={m.id} className="truncate">• {m.label}</li>
                  ))
                )}
              </ul>
            </ScrollArea>
          </div>

          {/* Adição de oficiais */}
          <div className="grid gap-3">
            <Label className="text-xs">Adicionar oficial</Label>
            <div className="flex gap-2">
              <Select value={pendingRole} onValueChange={setPendingRole}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário (mín. 2 caracteres)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {search.trim().length >= 2 && (
              <div className="border rounded-md max-h-[180px] overflow-y-auto divide-y">
                {isSearching ? (
                  <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Nenhum usuário.</div>
                ) : (
                  searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addPick(u.id, u.full_name ?? "Sem nome")}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                    >
                      {u.full_name ?? "Sem nome"}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Lista de oficiais escolhidos */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Oficiais a designar
            </Label>
            <div className="mt-2 space-y-1.5">
              {picks.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum oficial adicionado.
                </p>
              ) : (
                picks.map((p, idx) => (
                  <div
                    key={`${p.user_id}-${p.role}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium">{p.full_name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {ROLE_OPTIONS.find((r) => r.value === p.role)?.label ?? p.role}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removePick(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {picks.length > 0 && matches.length > 0 && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              Serão criadas até <strong>{totalDesignacoes}</strong> designações
              ({picks.length} × {matches.length}). Duplicatas serão ignoradas.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => applyMut.mutate()}
            disabled={
              applyMut.isPending ||
              picks.length === 0 ||
              matches.length === 0
            }
          >
            {applyMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Aplicar escala
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formatMatchLabel(m: {
  match_number: number | null;
  match_date: string | null;
  start_time: string | null;
  sport_events?: { sports?: { name: string | null } | null; categories?: { name: string | null } | null } | null;
  venues?: { name: string | null } | null;
}): string {
  const sport = m.sport_events?.sports?.name ?? "—";
  const cat = m.sport_events?.categories?.name ?? "";
  const date = m.match_date
    ? (() => {
        try {
          return format(parse(m.match_date, "yyyy-MM-dd", new Date()), "dd/MM");
        } catch {
          return m.match_date;
        }
      })()
    : "s/data";
  const time = m.start_time ? ` ${m.start_time.slice(0, 5)}` : "";
  return `#${m.match_number ?? "—"} · ${sport}${cat ? ` (${cat})` : ""} · ${date}${time}${
    m.venues?.name ? ` · ${m.venues.name}` : ""
  }`;
}
