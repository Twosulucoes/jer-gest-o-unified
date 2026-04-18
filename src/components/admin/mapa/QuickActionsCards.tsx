import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard, Users, Swords, Trophy } from "lucide-react";

const actions = [
  {
    label: "Central da Competição",
    description: "Hub operacional por prova",
    route: "/admin/competicao/central",
    icon: LayoutDashboard,
  },
  {
    label: "Participantes",
    description: "Atletas e dirigentes",
    route: "/admin/participantes",
    icon: Users,
  },
  {
    label: "Partidas",
    description: "Confrontos e agenda",
    route: "/admin/competicao/partidas",
    icon: Swords,
  },
  {
    label: "Resultados",
    description: "Lançamento e governança",
    route: "/admin/competicao/resultados",
    icon: Trophy,
  },
];

export default function QuickActionsCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {actions.map((a) => (
        <Link key={a.route} to={a.route}>
          <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="pt-4 pb-4 flex flex-col items-center text-center gap-2">
              <a.icon className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
