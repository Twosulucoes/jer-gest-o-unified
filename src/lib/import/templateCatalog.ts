/**
 * @deprecated FONTE OBSOLETA — use `@/regras/jer2026` como fonte de verdade.
 *
 * Este arquivo agora é apenas um adapter de retrocompatibilidade que projeta a
 * fonte de verdade JER 2026 no formato antigo de catálogo. Todo código novo
 * deve importar diretamente de `@/regras/jer2026`.
 *
 * Será removido em uma próxima limpeza.
 */

import {
  FONTE_DE_VERDADE_JER2026,
  CATEGORIAS_JER2026,
  MODALIDADES_TODAS,
} from "@/regras/jer2026";

export interface CatalogModalidade {
  nome: string;
  tipo: "individual" | "coletivo";
  provas: string[];
}

/** Projeção da fonte de verdade no formato antigo. */
export const MODALIDADES_CATALOGO: CatalogModalidade[] = MODALIDADES_TODAS.map((m) => ({
  nome: m.nome,
  tipo: m.tipo === "coletiva" ? "coletivo" : "individual",
  provas: m.provas.map((p) => p.nome),
}));

/** Categorias canônicas do JER 2026 (faixas por ano de nascimento). */
export const CATEGORIAS_CATALOGO = CATEGORIAS_JER2026.map((c) => {
  const evYear = FONTE_DE_VERDADE_JER2026.regras_gerais.evento.ano;
  return {
    nome: c.nome,
    idade_min: evYear - c.max_ano_nascimento,
    idade_max: evYear - c.min_ano_nascimento,
  };
});

export const NAIPES = ["Masculino", "Feminino", "Misto"] as const;

export const TIPOS_USUARIO = [
  "Atleta", "Técnico", "Chefe de Delegação", "Árbitro",
  "Auxiliar", "Dirigente", "Médico", "Fisioterapeuta", "Massagista",
] as const;

export const TIPO_USUARIO_MAP: Record<string, string> = {
  "Atleta": "athlete",
  "Técnico": "coach",
  "Árbitro": "referee",
  "Chefe de Delegação": "head_of_delegation",
  "Auxiliar": "staff",
  "Dirigente": "staff",
  "Médico": "staff",
  "Fisioterapeuta": "staff",
  "Massagista": "staff",
};

export const STATUS_INSCRICAO = ["Deferida", "Aprovada", "Indeferida", "Pendente"] as const;
export const SEXOS = ["Masculino", "Feminino"] as const;
export const PCD_VALORES = [
  "Não", "Sim - Física", "Sim - Visual", "Sim - Auditiva", "Sim - Intelectual",
] as const;
export const ESFERAS = ["Estadual", "Municipal", "Federal", "Particular"] as const;
