import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Bus, UtensilsCrossed, Building } from "lucide-react";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";

export default function DelegacaoLogisticaPage() {
  const navigate = useNavigate();

  const items = [
    { label: "Transporte", desc: "Viagens e horários", icon: Bus, color: "text-blue-600" },
    { label: "Alimentação", desc: "Janelas e locais de refeição", icon: UtensilsCrossed, color: "text-orange-600" },
    { label: "Alojamento", desc: "Informações de hospedagem", icon: Building, color: "text-teal-600" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/delegacao")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Bus className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Logística</span>
        <div className="ml-auto"><PwaRefreshButton /></div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {items.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </div>
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
