import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart3, Trophy, Receipt, BadgeCheck, ClipboardList, Layers, PackageCheck, ScanLine } from "lucide-react";

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
    key: "credenciamento",
    title: "Credenciamento",
    description: "Status de check-in, emissão de credenciais e progresso por delegação.",
    icon: <BadgeCheck className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/credenciamento",
  },
  {
    key: "boletins",
    title: "Boletins por Modalidade",
    description: "Resultados oficiais por modalidade, categoria, gênero e fase. Exportação em PDF e XLSX.",
    icon: <FileText className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/boletins",
  },
  {
    key: "consolidado",
    title: "Consolidado de Etapas",
    description: "Totais agregados de todas as etapas do evento (inscrições, credenciamento e operacional), sem duplicar participante. Exportação PDF e Excel.",
    icon: <Layers className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/consolidado",
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
    description: "Ranking de medalhas e pontuação do Campeonato Geral por delegação (Art. 108 e 111).",
    icon: <Trophy className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/quadro-medalhas",
  },
  {
    key: "osc",
    title: "Prestação de Contas (OSC)",
    description: "Relatório formal consolidado para Governo de Roraima, IDJUV, Acolher e órgãos de controle. Exportação PDF oficial e XLSX analítico.",
    icon: <Receipt className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/osc",
  },
  {
    key: "execucao-fisica",
    title: "Execução Física das Metas (OSC)",
    description: "Relatório de execução FÍSICA das metas do Termo de Fomento para o IDJUV (processo SEI). Meta 1 por etapa regional e Meta 2 previsto x executado. Exportação PDF e DOCX.",
    icon: <ClipboardList className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/execucao-fisica",
  },
  {
    key: "material",
    title: "Entregas de Material",
    description: "Progresso de entrega dos kits de material por escola/delegação, com pendências e estornos. Exportação PDF e Excel.",
    icon: <PackageCheck className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/material",
  },
  {
    key: "material-duplicidades",
    title: "Duplicidades — Entrega de Material",
    description: "Tentativas de reentrega de crachá já classificadas (erro técnico x tentativa real), com declaração individual para justificar casos questionados por escolas/participantes. Exportação PDF e Excel.",
    icon: <ScanLine className="h-6 w-6 text-primary" />,
    status: "available",
    to: "/admin/relatorios/material-duplicidades",
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
