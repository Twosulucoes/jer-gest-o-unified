/**
 * FONTE DE VERDADE ÚNICA — JER 2026.
 *
 * Este arquivo agrega todas as regras parametrizáveis do regulamento
 * consolidado (Regulamento Geral 53º JER's + 1º JERPA + Regulamentos Específicos).
 *
 * Todo o sistema (importação, motor de competição, central de regras,
 * validações, relatórios) consome SOMENTE deste módulo. Qualquer outro
 * arquivo de catálogo/regras está obsoleto e deve ser apagado.
 */

import type { FonteDeVerdade, Modalidade } from "./types";
import { CATEGORIAS_JER2026, ALIASES_CATEGORIAS } from "./categorias";
import { REGRAS_GERAIS_JER2026 } from "./regras-gerais";
import { MODALIDADES_COLETIVAS } from "./modalidades-coletivas";
import { MODALIDADES_COMBATE } from "./modalidades-combate";
import { MODALIDADES_TEMPO_MARCA } from "./modalidades-tempo-marca";
import { MODALIDADES_TECNICAS } from "./modalidades-tecnicas";
import { MODALIDADES_PARALIMPICAS } from "./modalidades-paralimpicas";

const MODALIDADES_TODAS: Modalidade[] = [
  ...MODALIDADES_COLETIVAS,
  ...MODALIDADES_COMBATE,
  ...MODALIDADES_TEMPO_MARCA,
  ...MODALIDADES_TECNICAS,
  ...MODALIDADES_PARALIMPICAS,
];

function buildAliasesModalidades(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of MODALIDADES_TODAS) {
    map[m.nome.toUpperCase()] = m.slug;
    map[m.slug.toUpperCase()] = m.slug;
    for (const alias of m.aliases) map[alias.toUpperCase()] = m.slug;
  }
  return map;
}

export const FONTE_DE_VERDADE_JER2026: FonteDeVerdade = {
  versao: "1.0",
  gerado_em: "2026-04-18",
  regras_gerais: REGRAS_GERAIS_JER2026,
  categorias: CATEGORIAS_JER2026,
  modalidades: MODALIDADES_TODAS,
  aliases_modalidades: buildAliasesModalidades(),
  aliases_categorias: ALIASES_CATEGORIAS,
};

// ── Helpers públicos ─────────────────────────────────────────────────────

export function findModalidade(slug: string): Modalidade | undefined {
  return MODALIDADES_TODAS.find((m) => m.slug === slug);
}

export function resolveModalidadeAlias(input: string): string | null {
  const norm = input.trim().toUpperCase();
  return FONTE_DE_VERDADE_JER2026.aliases_modalidades[norm] ?? null;
}

export function resolveCategoriaAlias(input: string): string | null {
  const norm = input.trim().toUpperCase();
  return FONTE_DE_VERDADE_JER2026.aliases_categorias[norm] ?? null;
}

export function resolveCategoriaPorAnoNascimento(
  modalidadeSlug: string,
  anoNascimento: number,
): string | null {
  const mod = findModalidade(modalidadeSlug);
  if (!mod) return null;
  for (const catSlug of mod.categorias) {
    const cat = CATEGORIAS_JER2026.find((c) => c.slug === catSlug);
    if (!cat) continue;
    if (anoNascimento >= cat.min_ano_nascimento && anoNascimento <= cat.max_ano_nascimento) {
      return cat.slug;
    }
  }
  return null;
}

export { CATEGORIAS_JER2026, REGRAS_GERAIS_JER2026, MODALIDADES_TODAS };
export * from "./types";
