import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Swords, CheckCircle2, Medal } from "lucide-react";

interface Props {
  totalEvents: number;
  totalMatches: number;
  publishedResults: number;
  podiums: number;
}

export default function ParticipantSportHistorySummary({ totalEvents, totalMatches, publishedResults, podiums }: Props) {
  const items = [
    { icon: Trophy, label: "Provas inscritas", value: totalEvents, color: "text-primary" },
    { icon: Swords, label: "Partidas disputadas", value: totalMatches, color: "text-blue-600" },
    { icon: CheckCircle2, label: "Resultados publicados", value: publishedResults, color: "text-green-600" },
    { icon: Medal, label: "Pódios", value: podiums, color: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ icon: Icon, label, value, color }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-3 p-4">
            <Icon className={`h-5 w-5 ${color} shrink-0`} />
            <div>
              <p className="text-2xl font-bold leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
