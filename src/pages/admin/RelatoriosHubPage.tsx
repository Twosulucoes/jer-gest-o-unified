import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart3, Trophy, Receipt } from "lucide-react";

interface ReportEntry {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "available" | "soon";
  to?: string;
}

const REPORTS: ReportEntry[] = [
  {
    key: "boletins",
    title: "Boletins por Modalidade",
    description: "Resultados oficiais por modalidade, categoria, gênero e fase. Exportação em PDF e XLSX.",
    icon: <FileText className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/boletins",
  },
  {
    key: "dashboard",
    title: "Dashboard Operacional",
    description: "Visão consolidada em tempo real de credenciamento, alojamento, alimentação e transporte.",
    icon: <BarChart3 className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/dashboard",
  },
  {
    key: "medalhas",
    title: "Quadro de Medalhas",
    description: "Ranking de medalhas e pontuação geral por delegação.",
    icon: <Trophy className="h-6 w-6 text-primary" />,
    status: "soon",
  },
  {
    key: "osc",
    title: "Prestação de Contas (OSC)",
    description: "Relatório formal para prestação de contas junto a parceiros e órgãos de controle.",
    icon: <Receipt className="h-6 w-6 text-primary" />,
    status: "soon",
  },
];

export default function RelatoriosHubPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold">Central de Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Documentos oficiais e painéis consolidados do evento. Os modelos abaixo serão liberados gradualmente.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {REPORTS.map((r) => {
          const card = (
            <Card className={`h-full transition-all ${r.status === "available" ? "hover:shadow-md cursor-pointer" : "opacity-70"}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {r.icon}
                    </div>
                    <CardTitle className="text-base">{r.title}</CardTitle>
                  </div>
                  {r.status === "soon" ? (
                    <Badge variant="secondary">Em breve</Badge>
                  ) : (
                    <Badge>Disponível</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{r.description}</CardDescription>
              </CardContent>
            </Card>
          );
          return r.status === "available" && r.to ? (
            <Link key={r.key} to={r.to}>{card}</Link>
          ) : (
            <div key={r.key}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
