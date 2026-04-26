import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BracketData, BracketMatch, BracketEntry } from "@/hooks/useKnockoutBracket";

interface Props {
  data: BracketData | undefined;
  isLoading: boolean;
}

function getRoundLabel(roundNum: number, totalRounds: number): string {
  const fromEnd = totalRounds - roundNum;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Quartas";
  return `Rodada ${roundNum}`;
}

function EntryLabel({ entry, side, isWinner, isFinished, isBye }: { 
  entry?: BracketEntry; 
  side: string; 
  isWinner: boolean;
  isFinished: boolean;
  isBye: boolean;
}) {
  if (!entry) {
    if (isBye) return <span className="text-xs text-muted-foreground italic opacity-50">BYE</span>;
    return <span className="text-xs text-muted-foreground italic">A definir</span>;
  }
  
  const label = entry.participant_name || entry.team_name || "—";
  const isLoser = isFinished && !isWinner && !isBye;

  return (
    <div className={cn(
      "flex items-center gap-1.5 min-w-0 transition-all",
      isWinner && "font-bold text-primary",
      isLoser && "line-through opacity-50 text-muted-foreground"
    )}>
      {entry.seed && (
        <span className="text-[10px] font-bold text-muted-foreground shrink-0">[{entry.seed}]</span>
      )}
      <span className="text-xs truncate">{label}</span>
      {isWinner && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
    </div>
  );
}

function MatchCard({ match, totalRounds }: { match: BracketMatch; totalRounds: number }) {
  const entries = match.entries ?? [];
  const sideA = entries.find((e) => e.side === "home" || e.side === "A");
  const sideB = entries.find((e) => e.side === "away" || e.side === "B");

  const isBye = match.status === "finished" && entries.length < 2;
  const isFinished = match.status === "finished" && !isBye;

  return (
    <Card className={cn(
      "p-2 w-[220px] border shadow-sm transition-all",
      isBye ? "border-dashed opacity-60 bg-muted/20" : "bg-card",
      isFinished && "border-primary/20"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground font-mono">#{match.match_number}</span>
        <Badge
          variant={isFinished ? "default" : isBye ? "secondary" : "outline"}
          className="text-[10px] h-4 px-1"
        >
          {isBye ? "BYE" : match.status === "finished" ? "Encerrada" : match.status}
        </Badge>
      </div>
      <div className="space-y-1.5">
        <div className={cn(
          "p-1.5 rounded-md transition-colors",
          sideA?.is_winner ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30"
        )}>
          <EntryLabel 
            entry={sideA} 
            side="A" 
            isWinner={sideA?.is_winner || false} 
            isFinished={isFinished}
            isBye={isBye && !sideA}
          />
        </div>
        <div className={cn(
          "p-1.5 rounded-md transition-colors",
          sideB?.is_winner ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30"
        )}>
          <EntryLabel 
            entry={sideB} 
            side="B" 
            isWinner={sideB?.is_winner || false} 
            isFinished={isFinished}
            isBye={isBye && !sideB}
          />
        </div>
      </div>
      {match.match_date && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {match.match_date} {match.start_time ?? ""}
        </p>
      )}
      {match.venue_name && (
        <p className="text-[10px] text-muted-foreground">{match.venue_name}</p>
      )}
    </Card>
  );
}

export default function BracketView({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex gap-6 overflow-x-auto p-4">
        {[1, 2, 3].map((r) => (
          <div key={r} className="space-y-4 min-w-[200px]">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data?.rounds || data.rounds.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma chave gerada para esta fase.</p>;
  }

  const totalRounds = data.rounds.length;

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {data.rounds.map((round) => (
        <div key={round.round_num} className="flex flex-col gap-3 min-w-[220px]">
          <h4 className="text-sm font-semibold text-center border-b pb-1">
            {getRoundLabel(round.round_num, totalRounds)}
          </h4>
          <div className="flex flex-col gap-3 justify-around flex-1">
            {round.matches.map((match) => (
              <MatchCard key={match.match_id} match={match} totalRounds={totalRounds} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
