import { Link } from "react-router-dom";
import { FileBarChart, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REPORTS = [
  { label: "Credenciamento", description: "Status de check-in e emissão de credenciais.", to: "/admin/relatorios?area=credenciamento" },
  { label: "Competição", description: "Resultados, classificações e pendências.", to: "/admin/relatorios?area=competicao" },
  { label: "Alojamento", description: "Ocupação por local e unidade.", to: "/admin/relatorios?area=alojamento" },
  { label: "Alimentação", description: "Consumos e pendências por janela.", to: "/admin/relatorios?area=alimentacao" },
  { label: "Transporte", description: "Embarques, viagens e ocorrências.", to: "/admin/relatorios?area=transporte" },
];

export default function StageReportsPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-primary" /> Relatórios da Etapa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Relatórios operacionais filtrados pelo contexto desta etapa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link key={r.to} to={r.to} className="group">
            <Card className="h-full hover:border-primary hover:shadow-app-md transition-all">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="group-hover:text-primary transition-colors">{r.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
