import { useLocation, useParams } from "react-router-dom";
import {
  BadgeCheck, Trophy, Building, UtensilsCrossed, Bus,
  AlertTriangle, ClipboardList, FileBarChart,
  LayoutDashboard, ListChecks, GitBranch, Users, CalendarClock, Layers,
  ScanLine, KeyRound, ChartBar, Navigation, Route, Settings, Filter,
} from "lucide-react";
import { StageMiniDash, type StageMiniDashKpi } from "./StageMiniDash";
import { StageModuleTabs, type StageTabItem } from "./StageModuleTabs";
import { useStageContext } from "@/contexts/StageContext";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_OPS: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];
const COMPETITION_ROLES: AppRole[] = [...ALL_OPS, "coordenador_modalidade"];
const LODGING_ROLES: AppRole[] = [...ALL_OPS, "alojamento"];
const FOOD_ROLES: AppRole[] = [...ALL_OPS, "alimentacao"];
const TRANSPORT_ROLES: AppRole[] = [...ALL_OPS, "transporte"];

interface ModuleConfig {
  /** Prefixo da rota relativa (ex.: "competicao"). */
  prefix: string;
  tabs: StageTabItem[];
}

const MODULES: ModuleConfig[] = [
  {
    prefix: "credenciamento",
    tabs: [
      { label: "Credenciamento", to: "credenciamento", icon: <BadgeCheck className="h-3.5 w-3.5" />, end: true, roles: ALL_OPS },
      { label: "Externos", to: "credenciamento-externo", icon: <KeyRound className="h-3.5 w-3.5" />, roles: ALL_OPS },
      { label: "Validação QR", to: "validacao-qr", icon: <ScanLine className="h-3.5 w-3.5" />, roles: ALL_OPS },
    ],
  },
  {
    prefix: "competicao",
    tabs: [
      { label: "Painel", to: "competicao/painel", icon: <LayoutDashboard className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
      { label: "Pré-validação", to: "competicao/pre-validacao", icon: <ListChecks className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
      { label: "Central", to: "competicao/central", icon: <Trophy className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
      { label: "Fases", to: "competicao/fases", icon: <GitBranch className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
      { label: "Grupos", to: "competicao/grupos", icon: <Users className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
      { label: "Equipes", to: "competicao/equipes", icon: <Users className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
      { label: "Agenda", to: "competicao/partidas-agenda", icon: <CalendarClock className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
      { label: "Resultados", to: "competicao/resultados", icon: <ChartBar className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
      { label: "Regras", to: "competicao/regras", icon: <Settings className="h-3.5 w-3.5" />, roles: COMPETITION_ROLES },
    ],
  },
  {
    prefix: "alojamento",
    tabs: [
      { label: "Visão geral", to: "alojamento", icon: <Building className="h-3.5 w-3.5" />, end: true, roles: LODGING_ROLES },
      { label: "Locais", to: "alojamento/locais", icon: <Building className="h-3.5 w-3.5" />, roles: LODGING_ROLES },
      { label: "Quartos", to: "alojamento/unidades", icon: <Layers className="h-3.5 w-3.5" />, roles: LODGING_ROLES },
      { label: "Ocupação", to: "alojamento/ocupacao", icon: <KeyRound className="h-3.5 w-3.5" />, roles: LODGING_ROLES },
      { label: "Relatórios", to: "alojamento/relatorios", icon: <FileBarChart className="h-3.5 w-3.5" />, roles: LODGING_ROLES },
    ],
  },
  {
    prefix: "alimentacao",
    tabs: [
      { label: "Visão geral", to: "alimentacao", icon: <UtensilsCrossed className="h-3.5 w-3.5" />, end: true, roles: FOOD_ROLES },
      { label: "Tipos", to: "alimentacao/tipos", icon: <UtensilsCrossed className="h-3.5 w-3.5" />, roles: FOOD_ROLES },
      { label: "Janelas", to: "alimentacao/janelas", icon: <CalendarClock className="h-3.5 w-3.5" />, roles: FOOD_ROLES },
      { label: "Consumo", to: "alimentacao/consumo", icon: <ClipboardList className="h-3.5 w-3.5" />, roles: FOOD_ROLES },
      { label: "Dashboard", to: "alimentacao/dashboard", icon: <LayoutDashboard className="h-3.5 w-3.5" />, roles: FOOD_ROLES },
      { label: "Relatórios", to: "alimentacao/relatorios", icon: <FileBarChart className="h-3.5 w-3.5" />, roles: FOOD_ROLES },
    ],
  },
  {
    prefix: "transporte",
    tabs: [
      { label: "Visão geral", to: "transporte", icon: <Bus className="h-3.5 w-3.5" />, end: true, roles: TRANSPORT_ROLES },
      { label: "Veículos", to: "transporte/veiculos", icon: <Bus className="h-3.5 w-3.5" />, roles: TRANSPORT_ROLES },
      { label: "Rotas", to: "transporte/rotas", icon: <Route className="h-3.5 w-3.5" />, roles: TRANSPORT_ROLES },
      { label: "Viagens", to: "transporte/viagens", icon: <Navigation className="h-3.5 w-3.5" />, roles: TRANSPORT_ROLES },
      { label: "Relatórios", to: "transporte/relatorios", icon: <FileBarChart className="h-3.5 w-3.5" />, roles: TRANSPORT_ROLES },
    ],
  },
  {
    prefix: "pesquisa",
    tabs: [
      { label: "Dashboard", to: "pesquisa", icon: <LayoutDashboard className="h-3.5 w-3.5" />, end: true, roles: ALL_OPS },
      { label: "Eventos", to: "pesquisa/eventos", icon: <ClipboardList className="h-3.5 w-3.5" />, roles: ALL_OPS },
      { label: "Pesquisadores", to: "pesquisa/pesquisadores", icon: <Users className="h-3.5 w-3.5" />, roles: ALL_OPS },
    ],
  },
];

interface StagePageScaffoldProps {
  children: React.ReactNode;
  /** KPIs específicos do módulo. */
  moduleKpis?: StageMiniDashKpi[];
  /** Não exibir KPIs gerais da etapa. */
  hideGlobalKpis?: boolean;
  /** Esconder tabs do módulo (ex.: páginas de detalhe). */
  hideTabs?: boolean;
}

/**
 * Wrapper aplicado entre StageLayout e cada página de módulo da etapa.
 * Renderiza:
 *  1) StageMiniDash híbrido (KPIs gerais + opcional módulo)
 *  2) StageModuleTabs (subnavegação horizontal) — detectada pela rota atual
 *  3) Conteúdo da página
 */
export function StagePageScaffold({
  children,
  moduleKpis,
  hideGlobalKpis,
  hideTabs,
}: StagePageScaffoldProps) {
  const location = useLocation();
  const { stageId } = useParams<{ stageId: string }>();

  // Identifica módulo pela rota: /admin/etapa/:stageId/<prefix>[/...]
  const base = `/admin/etapa/${stageId}/`;
  const sub = location.pathname.startsWith(base)
    ? location.pathname.slice(base.length)
    : "";
  const firstSegment = sub.split("/")[0] ?? "";

  const moduleCfg = MODULES.find((m) => m.prefix === firstSegment);

  return (
    <div className="space-y-4">
      <StageMiniDash moduleKpis={moduleKpis} hideGlobal={hideGlobalKpis} />
      {!hideTabs && moduleCfg && <StageModuleTabs items={moduleCfg.tabs} />}
      <div className="pt-1">{children}</div>
    </div>
  );
}
