import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StandingRow {
  rank: number;
  team_id: string;
  team_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  wo_wins: number;
  wo_losses: number;
  red_cards: number;
  yellow_cards: number;
  tie_explain: string | null;
}

interface Props {
  groupId: string;
}

export default function GroupStandingsTable({ groupId }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["group_standings", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_standings" as any, { p_group_id: groupId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!groupId,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center gap-2">
          Erro ao calcular classificação: {(error as Error).message}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const rows: StandingRow[] = data?.standings ?? [];

  if (rows.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Sem dados suficientes para classificação.</AlertDescription>
      </Alert>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-center w-10">Pts</TableHead>
              <TableHead className="text-center w-10">J</TableHead>
              <TableHead className="text-center w-10">V</TableHead>
              <TableHead className="text-center w-10">E</TableHead>
              <TableHead className="text-center w-10">D</TableHead>
              <TableHead className="text-center w-12">GP</TableHead>
              <TableHead className="text-center w-12">GC</TableHead>
              <TableHead className="text-center w-12">SG</TableHead>
              <TableHead className="text-center w-10">CA</TableHead>
              <TableHead className="text-center w-10">CV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.team_id}>
                <TableCell className="text-center font-medium">{row.rank}</TableCell>
                <TableCell className="font-medium">
                  {row.tie_explain ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted">{row.team_name}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-[200px]">{row.tie_explain}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    row.team_name
                  )}
                </TableCell>
                <TableCell className="text-center font-bold">{row.points}</TableCell>
                <TableCell className="text-center">{row.played}</TableCell>
                <TableCell className="text-center">{row.wins}</TableCell>
                <TableCell className="text-center">{row.draws}</TableCell>
                <TableCell className="text-center">{row.losses}</TableCell>
                <TableCell className="text-center">{row.goals_for}</TableCell>
                <TableCell className="text-center">{row.goals_against}</TableCell>
                <TableCell className="text-center">{row.goal_diff}</TableCell>
                <TableCell className="text-center">{row.yellow_cards}</TableCell>
                <TableCell className="text-center">{row.red_cards}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
