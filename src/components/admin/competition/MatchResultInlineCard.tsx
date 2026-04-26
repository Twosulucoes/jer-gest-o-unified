import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, Loader2, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

// ── Types ───────────────────────────────────────────────────
export interface InlineMatchEntry {
  entryId: string;
  teamId: string | null;
  teamName: string;
  institution: string;
  side: string;
}

export interface InlineMatchData {
  matchId: string;
  matchNumber: number;
  status: string;
  entries: InlineMatchEntry[];
  winnerEntryId?: string | null;
  scoreHome?: string | null;
  scoreAway?: string | null;
}

const MATCH_STATUSES = [
  { value: "scheduled", label: "Agendado", variant: "outline" as const },
  { value: "in_progress", label: "Em andamento", variant: "secondary" as const },
  { value: "finished", label: "Encerrado", variant: "default" as const },
  { value: "homologated", label: "Homologado", variant: "default" as const },
  { value: "cancelled", label: "Cancelado", variant: "destructive" as const },
];

function statusLabel(s: string) {
  return MATCH_STATUSES.find((ms) => ms.value === s)?.label ?? s;
}
function statusVariant(s: string) {
  return MATCH_STATUSES.find((ms) => ms.value === s)?.variant ?? ("outline" as const);
}

interface Props {
  match: InlineMatchData;
  canEdit: boolean;
  onResultSaved: () => void;
}

export default function MatchResultInlineCard({ match, canEdit, onResultSaved }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(match.status);
  const [scoreHome, setScoreHome] = useState(match.scoreHome ?? "");
  const [scoreAway, setScoreAway] = useState(match.scoreAway ?? "");
  const [winnerId, setWinnerId] = useState(match.winnerEntryId ?? "");

  const homeEntry = match.entries.find((e) => e.side === "home");
  const awayEntry = match.entries.find((e) => e.side === "away");

  const isFinished = status === "finished" || status === "homologated";

  const saveMut = useMutation({
    mutationFn: async () => {
      // Update match status
      const { error: mErr } = await supabase
        .from("competition_matches")
        .update({ status })
        .eq("id", match.matchId);
      if (mErr) throw mErr;

      // Upsert results for each entry if finished
      if (isFinished && match.entries.length > 0) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser?.id) {
          throw new Error("Usuário não autenticado — faça login novamente.");
        }
        for (const entry of match.entries) {
          const isWinner = entry.entryId === winnerId;
          const score = entry.side === "home" ? scoreHome : scoreAway;
          const outcome = winnerId
            ? isWinner ? "win" : "loss"
            : null;

          const { error: rErr } = await supabase
            .from("competition_match_results")
            .upsert(
              {
                match_id: match.matchId,
                match_entry_id: entry.entryId,
                outcome,
                score: score || null,
                result_status: status === "homologated" ? "resultado_validado" : "resultado_lancado",
                recorded_by: authUser.id,
                recorded_at: new Date().toISOString(),
              } as any,
              { onConflict: "match_entry_id" }
            );
          if (rErr) throw rErr;
        }
      }

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_matches",
        record_id: match.matchId,
        action: "inline_result_save",
        payload: { status, winnerId, scoreHome, scoreAway, by: user?.id },
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success(`Partida #${match.matchNumber} atualizada!`);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["dispute-builder-existing"] });
      qc.invalidateQueries({ queryKey: ["central-matches"] });
      qc.invalidateQueries({ queryKey: ["central-results"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
      onResultSaved();
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // View mode
  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <span className="text-muted-foreground w-5 text-right shrink-0">
          {match.matchNumber}.
        </span>
        <span className={cn("font-medium", winnerId === homeEntry?.entryId && "text-primary")}>
          {homeEntry?.teamName ?? "TBD"}
        </span>
        {(scoreHome || scoreAway) && (
          <span className="font-bold text-foreground">{scoreHome || "0"} × {scoreAway || "0"}</span>
        )}
        {!(scoreHome || scoreAway) && <span className="text-muted-foreground">vs</span>}
        <span className={cn("font-medium", winnerId === awayEntry?.entryId && "text-primary")}>
          {awayEntry?.teamName ?? "TBD"}
        </span>
        <Badge variant={statusVariant(match.status)} className="text-[10px] h-4 px-1 ml-1">
          {statusLabel(match.status)}
        </Badge>
        {winnerId && (
          <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[10px]"
            onClick={() => setEditing(true)}
          >
            Editar
          </Button>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <Card className="p-3 space-y-3 border-primary/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Partida #{match.matchNumber}</span>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_STATUSES.map((ms) => (
              <SelectItem key={ms.value} value={ms.value} className="text-xs">
                {ms.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Score inputs */}
      <div className="flex items-center gap-2">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-1 truncate">{homeEntry?.teamName ?? "A"}</p>
          <Input
            className="h-8 text-center text-sm font-bold"
            value={scoreHome}
            onChange={(e) => setScoreHome(e.target.value)}
            placeholder="0"
          />
        </div>
        <span className="text-xs font-bold text-muted-foreground mt-4">×</span>
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-1 truncate">{awayEntry?.teamName ?? "B"}</p>
          <Input
            className="h-8 text-center text-sm font-bold"
            value={scoreAway}
            onChange={(e) => setScoreAway(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Winner selection (for finished/homologated) */}
      {isFinished && match.entries.length >= 2 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Vencedor</p>
          <Select value={winnerId} onValueChange={setWinnerId}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Selecione vencedor" />
            </SelectTrigger>
            <SelectContent>
              {match.entries.map((e) => (
                <SelectItem key={e.entryId} value={e.entryId} className="text-xs">
                  {e.teamName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {status === "cancelled" && (
        <p className="text-[10px] text-destructive">Partida será marcada como cancelada.</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setEditing(false);
            setStatus(match.status);
            setScoreHome(match.scoreHome ?? "");
            setScoreAway(match.scoreAway ?? "");
            setWinnerId(match.winnerEntryId ?? "");
          }}
        >
          <XCircle className="h-3 w-3 mr-1" /> Cancelar
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3 mr-1" />
          )}
          Salvar
        </Button>
      </div>
    </Card>
  );
}
