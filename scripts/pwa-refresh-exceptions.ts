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
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WHITELIST_PATH = join(__dirname, "pwa-refresh-whitelist.json");

/** Raízes varridas pela auditoria/teste. */
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

/** Carrega e valida a whitelist JSON (SSOT das exceções). */
export function loadWhitelist(): Whitelist {
  const raw = readFileSync(WHITELIST_PATH, "utf8");
  const parsed = JSON.parse(raw) as Whitelist;
  if (!parsed || !Array.isArray(parsed.routes)) {
    throw new Error("[pwa-refresh-whitelist] Estrutura inválida: 'routes' ausente.");
  }
  const seen = new Set<string>();
  for (const r of parsed.routes) {
    if (!r.file || !r.category || !r.reason) {
      throw new Error(`[pwa-refresh-whitelist] Entrada incompleta: ${JSON.stringify(r)}`);
    }
    if (!/^src\/pages\/(pwa|aovivo)\/.+\.(tsx|jsx)$/.test(r.file)) {
      throw new Error(`[pwa-refresh-whitelist] Caminho fora das raízes PWA: ${r.file}`);
    }
    if (!["auth", "utility"].includes(r.category)) {
      throw new Error(`[pwa-refresh-whitelist] Categoria inválida em ${r.file}: ${r.category}`);
    }
    if (seen.has(r.file)) {
      throw new Error(`[pwa-refresh-whitelist] Entrada duplicada: ${r.file}`);
    }
    seen.add(r.file);
  }
  return parsed;
}

const WHITELIST = loadWhitelist();
const WHITELIST_SET: ReadonlySet<string> = new Set(WHITELIST.routes.map((r) => r.file));

/** Apenas leitura — útil para relatórios/auditoria. */
export const WHITELIST_ROUTES: readonly WhitelistEntry[] = WHITELIST.routes;

/**
 * Decide se um caminho relativo está isento da invariante.
 * Aceita separadores `/` ou `\` (normalizado internamente).
 */
export function isPwaRefreshException(rel: string): boolean {
  return WHITELIST_SET.has(rel.replace(/\\/g, "/"));
}

/**
 * Verifica se há entradas na whitelist apontando para arquivos inexistentes
 * (drift). Retorna a lista de caminhos órfãos.
 */
export function findOrphanWhitelistEntries(existingFiles: readonly string[]): string[] {
  const existing = new Set(existingFiles.map((f) => f.replace(/\\/g, "/")));
  return WHITELIST.routes.map((r) => r.file).filter((f) => !existing.has(f));
}
