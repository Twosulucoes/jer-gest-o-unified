import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { format } from "date-fns";
import { Plus, ArrowLeftRight, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SubstituicaoFormSheet from "@/components/substituicao/SubstituicaoFormSheet";

const STATUS_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  requested: { label: "Solicitada",  tone: "outline" },
  approved:  { label: "Aprovada",    tone: "default" },
  rejected:  { label: "Rejeitada",   tone: "destructive" },
  executed:  { label: "Executada",   tone: "secondary" },
  cancelled: { label: "Cancelada",   tone: "destructive" },
};

const REASON_LABEL: Record<string, string> = {
  lesao:       "Lesão",
  desistencia: "Desistência",
  disciplinar: "Disciplinar",
  convocacao:  "Convocação externa",
  outro:       "Outro",
};

export default function SubstituicaoPage() {
  const { hasRole, user } = useAuth();
  const eventId = useActiveEventId();

  const isDelegacao = hasRole("delegacao") && !hasRole("admin") && !hasRole("secretaria") && !hasRole("coordenacao_tecnica") && !hasRole("super_admin");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Para delegacao: busca a própria delegationId
  const { data: ownDelegationId } = useQuery({
    queryKey: ["own_delegation_id", user?.id],
    enabled: isDelegacao && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_delegations")
        .select("delegation_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.delegation_id ?? null;
    },
  });

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["substituicoes", eventId, isDelegacao ? ownDelegationId : "all"],
    enabled: !!eventId && (!isDelegacao || !!ownDelegationId),
    queryFn: async () => {
      let q = (supabase as any)
        .from("substitutions")
        .select(`
          id, status, reason, reason_code, requested_at, protocol_number, contact_email,
          sport_events(id, name, sports(name), categories(name)),
          event_stages(id, name),
          delegations(id, institutions(name)),
          out_part:participants!substitutions_participant_out_id_fkey(id, people(full_name)),
          in_part:participants!substitutions_participant_in_id_fkey(id, people(full_name))
        `)
        .eq("event_id", eventId)
        .order("requested_at", { ascending: false });

      if (isDelegacao && ownDelegationId) {
        q = q.eq("delegation_id", ownDelegationId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.toLowerCase();
    return rows.filter((r: any) => {
      const out = r.out_part?.people?.full_name?.toLowerCase() ?? "";
      const inn = r.in_part?.people?.full_name?.toLowerCase() ?? "";
      const sport = r.sport_events?.name?.toLowerCase() ?? "";
      const proto = (r.protocol_number ?? "").toLowerCase();
      return out.includes(term) || inn.includes(term) || sport.includes(term) || proto.includes(term);
    });
  }, [rows, search]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Substituições</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solicitação e acompanhamento de substituições de atletas no JER 2026.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova solicitação
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por atleta, modalidade ou protocolo…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Data</TableHead>
                {!isDelegacao && <TableHead>Delegação</TableHead>}
                <TableHead>Etapa</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Sai</TableHead>
                <TableHead>Entra</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={isDelegacao ? 7 : 8}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isDelegacao ? 7 : 8} className="text-center py-16 text-muted-foreground">
                    <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {search ? "Nenhuma substituição encontrada para a busca." : "Nenhuma substituição registrada ainda."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r: any) => {
                  const status = STATUS_LABEL[r.status] ?? { label: r.status, tone: "outline" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {r.protocol_number ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.requested_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      {!isDelegacao && (
                        <TableCell className="text-xs">{r.delegations?.institutions?.name ?? "—"}</TableCell>
                      )}
                      <TableCell className="text-xs">{r.event_stages?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div>{r.sport_events?.name ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.sport_events?.categories?.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {r.out_part?.people?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {r.in_part?.people?.full_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.tone}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 animate-pulse" /> Carregando…
        </div>
      )}

      <SubstituicaoFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
