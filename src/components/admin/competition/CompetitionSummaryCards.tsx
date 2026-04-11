import { Card, CardContent } from "@/components/ui/card";
import { Users, UsersRound, Swords, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Summary {
  is_collective: boolean;
  enrolled_count: number;
  teams_count: number;
  matches_count: number;
  matches_no_result: number;
}

interface Props {
  summary: Summary | null | undefined;
  loading: boolean;
}

export default function CompetitionSummaryCards({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Inscritos",
      value: summary.enrolled_count,
      icon: <Users className="h-5 w-5 text-blue-500" />,
    },
    ...(summary.is_collective
      ? [{
          label: "Equipes",
          value: summary.teams_count,
          icon: <UsersRound className="h-5 w-5 text-green-500" />,
        }]
      : []),
    {
      label: "Partidas",
      value: summary.matches_count,
      icon: <Swords className="h-5 w-5 text-purple-500" />,
    },
    {
      label: "Sem resultado",
      value: summary.matches_no_result,
      icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-6 flex items-center gap-4">
            {c.icon}
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
