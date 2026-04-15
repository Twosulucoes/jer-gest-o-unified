import {
  BookOpen, Users, Trophy, Target, Settings, Award, Send,
  Calendar, Shield, Building, Shirt, Bus, Utensils, BedDouble,
  FileText, UserCheck, Gavel, Replace, Gift, Scale, ClipboardList
} from "lucide-react";

export interface SectionDef {
  key: string;
  label: string;
  icon: any;
  group: "geral" | "competicao" | "logistica" | "governanca";
  description: string;
}

export const SECTION_CATALOG: SectionDef[] = [
  // Geral
  { key: "edition", label: "Edição", icon: BookOpen, group: "geral", description: "Dados da edição do evento" },
  { key: "comissoes", label: "Comissões", icon: Users, group: "geral", description: "Comitê organizador, gerências e comissões" },
  { key: "delegacao", label: "Delegação", icon: Building, group: "geral", description: "Composição, chefe de delegação e técnicos" },
  { key: "calendario", label: "Calendário", icon: Calendar, group: "geral", description: "Etapas classificatórias e fase final" },
  { key: "disposicoes_gerais", label: "Disposições Gerais", icon: FileText, group: "geral", description: "Regras gerais e disposições finais" },

  // Competição
  { key: "categorias", label: "Categorias", icon: Target, group: "competicao", description: "Faixas etárias e categorias" },
  { key: "modalidades", label: "Modalidades", icon: Trophy, group: "competicao", description: "Modalidades esportivas e variações" },
  { key: "participacao", label: "Participação", icon: UserCheck, group: "competicao", description: "Regras de participação e elegibilidade" },
  { key: "limites_atletas", label: "Limites de Atletas", icon: Users, group: "competicao", description: "Limites por modalidade coletiva/individual" },
  { key: "inscricoes", label: "Inscrições", icon: ClipboardList, group: "competicao", description: "Processo de inscrição e prazos" },
  { key: "pontuacao", label: "Pontuação", icon: Award, group: "competicao", description: "Tabela de pontos e critérios de desempate" },
  { key: "premiacao", label: "Premiação", icon: Gift, group: "competicao", description: "Troféus e medalhas por categoria" },

  // Logística
  { key: "credenciamento", label: "Credenciamento", icon: Shield, group: "logistica", description: "Regras de credenciamento e substituição" },
  { key: "substituicoes", label: "Substituições", icon: Replace, group: "logistica", description: "Regras de substituição de atletas" },
  { key: "uniformes", label: "Uniformes", icon: Shirt, group: "logistica", description: "Padrão de uniformes e patrocínio" },
  { key: "alojamento", label: "Alojamento", icon: BedDouble, group: "logistica", description: "Regras de hospedagem" },

  // Governança
  { key: "wo_wxo", label: "W.O. e WxO", icon: Settings, group: "governanca", description: "Tolerâncias, penalidades e exceções" },
  { key: "cde", label: "CDE / Justiça Desportiva", icon: Gavel, group: "governanca", description: "Protestos, penalidades e código disciplinar" },
];

export const GROUP_LABELS: Record<string, string> = {
  geral: "Geral",
  competicao: "Competição",
  logistica: "Logística",
  governanca: "Governança",
};

export function getSectionDef(key: string): SectionDef | undefined {
  return SECTION_CATALOG.find((s) => s.key === key);
}
