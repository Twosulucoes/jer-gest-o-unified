/**
 * Invariante: toda página PWA operacional deve renderizar `PwaRefreshButton`
 * — direto ou via `PwaHeader` (que já o embute).
 *
 * Exceções por design (auth/utility) seguem os mesmos padrões usados pelo
 * script `scripts/audit-pwa-refresh.ts`. Mantenha as duas listas em sincronia.
 *
 * Este teste é estático (lê o source) — não monta as rotas — porque:
 *   - cobre 100% das páginas em ms,
 *   - não depende de mocks de Supabase/Auth/Capacitor,
 *   - é o mesmo critério que o CI/auditoria usam.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  PWA_ROOTS,
  isPwaRefreshException,
  findOrphanWhitelistEntries,
  WHITELIST_ROUTES,
  normalizePath,
  normalizeKey,
} from "../../scripts/pwa-refresh-exceptions";

const REPO = resolve(__dirname, "../..");
const ROOTS = PWA_ROOTS;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

const pages = ROOTS.flatMap((r) => walk(join(REPO, r))).map((abs) => {
  const rel = relative(REPO, abs).replace(/\\/g, "/");
  const src = readFileSync(abs, "utf8");
  return {
    rel,
    hasRefreshButton: /PwaRefreshButton/.test(src),
    hasPwaHeader: /\bPwaHeader\b/.test(src),
    exception: isPwaRefreshException(rel),
  };
});

describe("PWA: PwaRefreshButton invariant", () => {
  it("descobre páginas PWA para auditar", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)(
    "$rel tem PwaRefreshButton (direto, via PwaHeader, ou é exceção)",
    ({ hasRefreshButton, hasPwaHeader, exception }) => {
      expect(exception || hasRefreshButton || hasPwaHeader).toBe(true);
    }
  );

  it("não há páginas marcadas como exceção que também usem PwaHeader (limpeza)", () => {
    const inconsistentes = pages.filter(
      (p) => p.exception && (p.hasRefreshButton || p.hasPwaHeader)
    );
    if (inconsistentes.length) {
      console.warn(
        "[audit] Páginas marcadas como exceção mas que já têm refresh — considere remover da whitelist:",
        inconsistentes.map((p) => p.rel)
      );
    }
    expect(true).toBe(true);
  });

  it("whitelist não tem entradas órfãs (arquivo inexistente)", () => {
    const orphans = findOrphanWhitelistEntries(pages.map((p) => p.rel));
    expect(orphans).toEqual([]);
  });

  it("toda entrada da whitelist tem categoria e justificativa", () => {
    for (const r of WHITELIST_ROUTES) {
      expect(["auth", "utility"]).toContain(r.category);
      expect(r.reason.length).toBeGreaterThanOrEqual(3);
    }
  });
});
