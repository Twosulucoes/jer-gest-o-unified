import { phoneMask } from "@/lib/phoneUtils";

// Fundação da Enquete de Reconhecimento JER 2026.
// Constantes e helpers puros — sem chamadas ao Supabase (isso fica nas telas).

export type EnqueteFase = "cadastro" | "votacao" | "apurada" | "encerrada";

export const ENQUETE_FASES: readonly EnqueteFase[] = [
  "cadastro",
  "votacao",
  "apurada",
  "encerrada",
];

// Slug ofuscado da rota de painel da direção (não é proteção de auth, só obscuridade).
export const ENQUETE_DIRECAO_SLUG = "direcao-jer2026-x7k";

export const ENQUETE_ROUTES = {
  cadastro: "/enquete",
  votar: "/enquete/votar",
  mural: "/enquete/mural",
  sobre: "/enquete/sobre",
  direcao: `/enquete/${ENQUETE_DIRECAO_SLUG}`,
} as const;

// Tags oficiais de contribuição (enq_contribuicoes.tag) — texto livre no banco,
// lista fechada é convenção do frontend para manter os chips consistentes.
export const ENQUETE_TAGS = [
  { id: "pontualidade", label: "Sempre no horário", emoji: "⏰" },
  { id: "resolve_tudo", label: "Resolve qualquer perrengue", emoji: "🔧" },
  { id: "trabalho_equipe", label: "Trabalho em equipe", emoji: "🤝" },
  { id: "bom_humor", label: "Bom humor no corre", emoji: "😄" },
  { id: "vai_alem", label: "Vai além da função", emoji: "🚀" },
  { id: "organizacao", label: "Organização impecável", emoji: "🗂️" },
  { id: "paciencia", label: "Paciência com todo mundo", emoji: "🧘" },
  { id: "apagou_incendio", label: "Apagou um incêndio", emoji: "🧯" },
  { id: "lideranca", label: "Puxou a liderança", emoji: "🧭" },
  { id: "ajudou_delegacao", label: "Ajudou uma delegação", emoji: "🚌" },
  { id: "madrugada", label: "Encarou a madrugada", emoji: "🌙" },
  { id: "sorriso_facil", label: "Sorriso fácil o tempo todo", emoji: "🙂" },
] as const;

export type EnqueteTagId = (typeof ENQUETE_TAGS)[number]["id"];

// Máximo de tags que um participante pode marcar no cadastro.
export const ENQUETE_MAX_TAGS = 4;

// Selos de zoeira — valores restritos por CHECK constraint no banco
// (enq_participantes_selo_zoeira_check: selo_01..selo_05). Rótulos são só de UI.
export const ENQUETE_SELOS_ZOEIRA = [
  { id: "selo_01", label: "Rei/Rainha da Zoeira", emoji: "🤡" },
  { id: "selo_02", label: "Comediante Oficial", emoji: "🎭" },
  { id: "selo_03", label: "Contador de Piada Ruim", emoji: "😂" },
  { id: "selo_04", label: "Alma da Festa", emoji: "🕺" },
  { id: "selo_05", label: "Bagunceiro(a) Nato(a)", emoji: "🎪" },
] as const;

export type EnqueteSeloZoeiraId = (typeof ENQUETE_SELOS_ZOEIRA)[number]["id"];

export const XP_POR_TAG = 10;
export const XP_POR_SUBJETIVA = 15;

// Reaproveita a máscara de telefone já existente no projeto (src/lib/phoneUtils.ts).
export { phoneMask };

export function normalizeTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

export interface EnqueteXpPreviewInput {
  tags?: string[];
  momentoMvp?: string;
  perrengue?: string;
}

export function calcXpPreview({ tags, momentoMvp, perrengue }: EnqueteXpPreviewInput): number {
  const xpTags = (tags?.length ?? 0) * XP_POR_TAG;
  const subjetivasPreenchidas = [momentoMvp, perrengue].filter(
    (valor) => !!valor && valor.trim().length > 0
  ).length;
  return xpTags + subjetivasPreenchidas * XP_POR_SUBJETIVA;
}

// Tipos dos retornos das RPCs (enq_finalizar_cadastro, enq_votar, enq_apuracao).
// enq_* ainda não estão nos tipos gerados do Supabase (src/integrations/supabase/types.ts).

export interface EnqueteFinalizarCadastroResult {
  ok: boolean;
  id?: string;
  xp?: number;
  titulo?: string;
  numero_sorte?: number;
  erro?: string;
}

export interface EnqueteVotarResult {
  ok: boolean;
  erro?: string;
}

export interface EnqueteApuracaoRow {
  categoria: string;
  emoji: string;
  participante: string;
  orgao: string;
  votos: number;
  posicao: number;
}
