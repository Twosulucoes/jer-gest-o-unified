import { Card, CardContent } from "@/components/ui/card";
import { Bus, UtensilsCrossed, Building } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import PwaLayout from "@/components/pwa/PwaLayout";

export default function DelegacaoLogisticaPage() {
  const items = [
    { label: "Transporte", desc: "Viagens e horários", icon: Bus, color: "text-blue-600" },
    { label: "Alimentação", desc: "Janelas e locais de refeição", icon: UtensilsCrossed, color: "text-orange-600" },
    { label: "Alojamento", desc: "Informações de hospedagem", icon: Building, color: "text-teal-600" },
  ];

  return (
    <PwaLayout backTo="/pwa/delegacao" moduleTitle="Logística">
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
    </PwaLayout>
  );
}
