/**
 * Fonte única de verdade para as exceções da regra "toda página PWA
 * operacional deve renderizar PwaRefreshButton".
 *
 * Consumido por:
 *   - scripts/audit-pwa-refresh.ts          (auditoria CLI / CI)
 *   - src/test/pwa-refresh-button.test.ts   (teste automatizado)
 *
 * REGRA DE NEGÓCIO — Telas isentas
 * --------------------------------
 * O botão de refresh só faz sentido em telas operacionais autenticadas que
 * exibem dados sincronizáveis. Estão isentas, por design:
 *
 *   1. Auth / pré-sessão (Login, Recover, SetPassword)
 *   2. Utilitárias / status fixo (AcessoNegado, Debug, Confirmação pós-ação)
 *
 * Como adicionar uma nova exceção:
 *   - Edite `scripts/pwa-refresh-whitelist.json` adicionando uma entrada com
 *     `file`, `category` e `reason`. NÃO edite este .ts — ele apenas carrega.
 *
 * Toda rota PWA NOVA é considerada OPERACIONAL por padrão e DEVE renderizar
 * `PwaRefreshButton` (direto ou via `PwaHeader`). Se faltar, a auditoria
 * (`bun run scripts/audit-pwa-refresh.ts`) e o teste Vitest falham.
 *
 * NORMALIZAÇÃO DE CAMINHOS
 * ------------------------
 * Esta camada é o único lugar onde caminhos são comparados. Garantimos:
 *   - Separador único `/` (Windows usa `\`; convertemos).
 *   - Sem prefixo `./` ou `/` inicial.
 *   - Sem barras duplicadas (`a//b` → `a/b`).
 *   - Comparação case-INSENSITIVE de chave (macOS/Windows são case-insensitive
 *     no FS; Linux é case-sensitive). Mantemos a forma original para mensagens.
 *
 * Toda comparação interna usa `normalizeKey()`. Toda exibição usa o original.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WHITELIST_PATH = join(__dirname, "pwa-refresh-whitelist.json");

/** Raízes varridas pela auditoria/teste (sempre em forma POSIX). */
export const PWA_ROOTS = ["src/pages/pwa", "src/pages/aovivo"] as const;

export type WhitelistCategory = "auth" | "utility";

export interface WhitelistEntry {
  file: string;
  category: WhitelistCategory;
  reason: string;
}

export interface Whitelist {
  routes: WhitelistEntry[];
  categories?: Record<string, string>;
  description?: string;
}

/**
 * Normaliza um caminho relativo para comparação:
 *   - converte `\` → `/`
 *   - colapsa barras duplas
 *   - remove prefixo `./` e `/` inicial
 *   - remove `/` final
 *
 * Mantém o case original (use `normalizeKey` quando precisar comparar).
 */
export function normalizePath(p: string): string {
  if (!p) return "";
  let out = p.replace(/\\/g, "/");
  out = out.replace(/\/{2,}/g, "/");
  out = out.replace(/^\.\//, "");
  out = out.replace(/^\/+/, "");
  out = out.replace(/\/+$/, "");
  return out;
}

/** Chave de comparação case-insensitive (FS portável). */
export function normalizeKey(p: string): string {
  return normalizePath(p).toLowerCase();
}

/** Carrega e valida a whitelist JSON (SSOT das exceções). */
export function loadWhitelist(): Whitelist {
  const raw = readFileSync(WHITELIST_PATH, "utf8");
  const parsed = JSON.parse(raw) as Whitelist;
  if (!parsed || !Array.isArray(parsed.routes)) {
    throw new Error("[pwa-refresh-whitelist] Estrutura inválida: 'routes' ausente.");
  }

  const seenKeys = new Map<string, string>(); // key → file original
  const allowedCategories: WhitelistCategory[] = ["auth", "utility"];
  const rootKeys = PWA_ROOTS.map((r) => normalizeKey(r));

  for (const r of parsed.routes) {
    if (!r.file || !r.category || !r.reason) {
      throw new Error(`[pwa-refresh-whitelist] Entrada incompleta: ${JSON.stringify(r)}`);
    }

    // Re-normaliza o file in-place para garantir forma POSIX consistente.
    const normalized = normalizePath(r.file);
    if (normalized !== r.file) {
      r.file = normalized;
    }

    if (!/^src\/pages\/(pwa|aovivo)\/.+\.(tsx|jsx)$/.test(r.file)) {
      throw new Error(`[pwa-refresh-whitelist] Caminho fora das raízes PWA: ${r.file}`);
    }

    const key = normalizeKey(r.file);
    if (!rootKeys.some((root) => key.startsWith(root + "/"))) {
      throw new Error(`[pwa-refresh-whitelist] Caminho não pertence a nenhuma PWA_ROOT: ${r.file}`);
    }

    if (!allowedCategories.includes(r.category)) {
      throw new Error(`[pwa-refresh-whitelist] Categoria inválida em ${r.file}: ${r.category}`);
    }

    if (seenKeys.has(key)) {
      throw new Error(
        `[pwa-refresh-whitelist] Entrada duplicada (case-insensitive): "${r.file}" colide com "${seenKeys.get(key)}"`
      );
    }
    seenKeys.set(key, r.file);
  }

  return parsed;
}

const WHITELIST = loadWhitelist();
const WHITELIST_KEYS: ReadonlySet<string> = new Set(
  WHITELIST.routes.map((r) => normalizeKey(r.file))
);

/** Apenas leitura — útil para relatórios/auditoria. */
export const WHITELIST_ROUTES: readonly WhitelistEntry[] = WHITELIST.routes;

/**
 * Decide se um caminho relativo está isento da invariante.
 * Aceita qualquer separador, prefixo `./`, barras duplas e qualquer case.
 */
export function isPwaRefreshException(rel: string): boolean {
  return WHITELIST_KEYS.has(normalizeKey(rel));
}

/**
 * Verifica se há entradas na whitelist apontando para arquivos inexistentes
 * (drift). A comparação é normalizada (case-insensitive, separadores).
 * Retorna a lista de caminhos órfãos na forma como aparecem no JSON.
 */
export function findOrphanWhitelistEntries(existingFiles: readonly string[]): string[] {
  const existingKeys = new Set(existingFiles.map((f) => normalizeKey(f)));
  return WHITELIST.routes
    .filter((r) => !existingKeys.has(normalizeKey(r.file)))
    .map((r) => r.file);
}
