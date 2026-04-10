import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, IdCard, Users, CheckCircle, XCircle, AlertCircle, ArrowRight } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta", coach: "Técnico", head_of_delegation: "Chefe", staff: "Staff",
};

interface Props {
  delegationId: string;
  eventId: string;
}

export default function DelegationCredenciamentoTab({ delegationId, eventId }: Props) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["delegation_cred_participants", delegationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, status, person_id")
        .eq("delegation_id", delegationId)
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const personIds = participants.map(p => p.person_id);
  const { data: people = [] } = useQuery({
    queryKey: ["delegation_cred_people", delegationId, personIds.length],
    queryFn: async () => {
      if (!personIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name").in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  const participantIds = participants.map(p => p.id);
  const { data: credentials = [] } = useQuery({
    queryKey: ["delegation_cred_credentials", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, participant_id, status, credential_code")
        .in("participant_id", participantIds)
        .eq("event_id", eventId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: participantIds.length > 0,
  });

  const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const credMap = useMemo(() => new Map(credentials.map(c => [c.participant_id, c])), [credentials]);

  const total = participants.length;
  const withCredential = credentials.length;
  const credentialed = participants.filter(p => p.status === "credentialed").length;
  const readyToCredential = participants.filter(p => (p.status === "confirmed" || p.status === "pending") && !credMap.has(p.id)).length;
  const cancelled = participants.filter(p => p.status === "cancelled").length;
  const progress = total > 0 ? Math.round((withCredential / total) * 100) : 0;

  const filtered = useMemo(() => {
    if (filter === "all") return participants;
    if (filter === "ready") return participants.filter(p => (p.status === "confirmed" || p.status === "pending") && !credMap.has(p.id));
    if (filter === "active") return participants.filter(p => credMap.has(p.id));
    if (filter === "without") return participants.filter(p => !credMap.has(p.id) && p.status !== "cancelled");
    if (filter === "credentialed") return participants.filter(p => p.status === "credentialed");
    return participants;
  }, [participants, filter, credMap]);

  // Selection helpers
  const readyIds = useMemo(
    () => new Set(participants.filter(p => (p.status === "confirmed" || p.status === "pending") && !credMap.has(p.id)).map(p => p.id)),
    [participants, credMap]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllReady = useCallback(() => {
    const filteredReadyIds = filtered.filter(p => readyIds.has(p.id)).map(p => p.id);
    setSelected(new Set(filteredReadyIds));
  }, [filtered, readyIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const handleBatchCredential = () => {
    // Navigate to credenciamento page — the filter there will allow processing
    navigate("/admin/credenciamento");
  };

  const FILTER_LABELS: Record<string, string> = {
    ready: "Aptos para credenciar",
    active: "Com credencial ativa",
    without: "Sem credencial",
    credentialed: "Credenciados",
  };

  if (isLoading) {
    return <div className="space-y-3 mt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (total === 0) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <IdCard className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum participante nesta delegação</p>
            <p className="text-sm text-muted-foreground mt-1">Cadastre participantes para iniciar o credenciamento.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso de credenciamento</span>
            <span className="text-sm text-muted-foreground">{withCredential}/{total} ({progress}%)</span>
          </div>
          <Progress value={progress} className="h-2" />
          {progress === 100 && total > 0 && (
            <p className="text-xs text-green-600 mt-1.5">✓ Todos os participantes possuem credencial ativa.</p>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={<Users className="h-4 w-4 text-primary" />} label="Total" value={total} onClick={() => { setFilter("all"); clearSelection(); }} active={filter === "all"} />
        <SummaryCard icon={<AlertCircle className="h-4 w-4 text-amber-600" />} label="Aptos" value={readyToCredential} onClick={() => { setFilter("ready"); clearSelection(); }} active={filter === "ready"} />
        <SummaryCard icon={<CheckCircle className="h-4 w-4 text-green-600" />} label="Credenciados" value={credentialed} onClick={() => { setFilter("credentialed"); clearSelection(); }} active={filter === "credentialed"} />
        <SummaryCard icon={<IdCard className="h-4 w-4 text-emerald-600" />} label="Credencial ativa" value={withCredential} onClick={() => { setFilter("active"); clearSelection(); }} active={filter === "active"} />
        <SummaryCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Sem credencial" value={total - withCredential - cancelled} onClick={() => { setFilter("without"); clearSelection(); }} active={filter === "without"} />
      </div>

      {/* Filter label + batch actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {filter !== "all" && (
          <>
            <Badge variant="secondary" className="text-xs">
              Filtro: {FILTER_LABELS[filter] ?? filter}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setFilter("all"); clearSelection(); }}>Limpar</Button>
          </>
        )}
        {readyIds.size > 0 && filtered.some(p => readyIds.has(p.id)) && (
          <div className="ml-auto flex items-center gap-2">
            {selected.size > 0 ? (
              <>
                <span className="text-xs text-muted-foreground">{selected.size} selecionado{selected.size !== 1 ? "s" : ""}</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>Limpar seleção</Button>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleBatchCredential}>
                  <ArrowRight className="h-3.5 w-3.5" />Ir para Credenciamento
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllReady}>
                Selecionar aptos ({filtered.filter(p => readyIds.has(p.id)).length})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Participant list */}
      {!filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <IdCard className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum participante neste filtro</p>
            <p className="text-sm text-muted-foreground mt-1">Altere o filtro acima para ver outros participantes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {readyIds.size > 0 && <TableHead className="w-[40px]" />}
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credencial</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const person = peopleMap.get(p.person_id);
                const cred = credMap.get(p.id);
                const isReady = readyIds.has(p.id);
                return (
                  <TableRow key={p.id} className={isReady ? "bg-amber-50/50 dark:bg-amber-950/10" : undefined}>
                    {readyIds.size > 0 && (
                      <TableCell className="pr-0">
                        {isReady && (
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => toggleSelect(p.id)}
                            aria-label={`Selecionar ${person?.full_name ?? ""}`}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{TYPE_LABELS[p.participant_type] ?? p.participant_type}</span>
                    </TableCell>
                    <TableCell>
                      {p.status === "credentialed" ? (
                        <Badge variant="default">Credenciado</Badge>
                      ) : p.status === "confirmed" ? (
                        <Badge variant="secondary">Confirmado</Badge>
                      ) : p.status === "cancelled" ? (
                        <Badge variant="destructive">Cancelado</Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {cred ? (
                        <span className="text-xs font-mono text-green-600">{cred.credential_code}</span>
                      ) : isReady ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          <AlertCircle className="h-3 w-3 mr-1" />Apto
                        </Badge>
                      ) : p.status === "cancelled" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <XCircle className="h-3 w-3" />Pendente
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/participantes/${p.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{filtered.length} de {total} participante(s)</p>
    </div>
  );
}

function SummaryCard({ icon, label, value, onClick, active }: { icon: React.ReactNode; label: string; value: number; onClick?: () => void; active?: boolean }) {
  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${active ? "ring-2 ring-primary/30 bg-muted/30" : ""}`}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-2.5 p-3">
        {icon}
        <div>
          <p className="text-lg font-bold leading-none text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
