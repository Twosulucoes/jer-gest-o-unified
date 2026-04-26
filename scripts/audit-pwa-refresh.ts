#!/usr/bin/env bun
/**
 * Audit PWA Refresh Button
 * ------------------------
 * Lista páginas PWA (src/pages/pwa/** e src/pages/aovivo/**) que NÃO contêm
 * o componente `PwaRefreshButton` — direta ou indiretamente via `PwaHeader`
 * (que já embute o botão).
 *
 * Uso:
 *   bun run scripts/audit-pwa-refresh.ts
 *   bun run scripts/audit-pwa-refresh.ts --json
 *   bun run scripts/audit-pwa-refresh.ts --all   # mostra também as OK
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PWA_ROOTS, isPwaRefreshException } from "./pwa-refresh-exceptions";

const ROOTS = PWA_ROOTS;
const REPO = process.cwd();

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const showAll = args.has("--all");

type Row = {
  file: string;
  hasRefreshButton: boolean;
  hasPwaHeader: boolean;
  ok: boolean;
  exception: boolean;
};

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(join(REPO, r)));
const rows: Row[] = files.map((abs) => {
  const rel = relative(REPO, abs);
  const src = readFileSync(abs, "utf8");
  const hasRefreshButton = /PwaRefreshButton/.test(src);
  const hasPwaHeader = /\bPwaHeader\b/.test(src);
  const exception = isPwaRefreshException(rel);
  const ok = exception || hasRefreshButton || hasPwaHeader;
  return { file: rel, hasRefreshButton, hasPwaHeader, ok, exception };
}).sort((a, b) => a.file.localeCompare(b.file));

const missing = rows.filter((r) => !r.ok);

if (asJson) {
  console.log(JSON.stringify({ total: rows.length, missing: missing.length, rows: showAll ? rows : missing }, null, 2));
  process.exit(missing.length ? 1 : 0);
}

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

console.log(`${BOLD}🔍 Auditoria PwaRefreshButton${RESET}`);
console.log(`${DIM}Raízes: ${ROOTS.join(", ")}${RESET}`);
console.log(`${DIM}Total de páginas analisadas: ${rows.length}${RESET}\n`);

if (showAll) {
  for (const r of rows) {
    const tag = r.exception
      ? `${DIM}EXC${RESET}`
      : r.ok
        ? `${GREEN}OK ${RESET}`
        : `${RED}MIS${RESET}`;
    const via = r.hasRefreshButton ? "direct" : r.hasPwaHeader ? "PwaHeader" : "—";
    console.log(`  ${tag}  ${r.file}  ${DIM}(${via})${RESET}`);
  }
  console.log("");
}

if (missing.length === 0) {
  console.log(`${GREEN}✅ Todas as páginas PWA possuem PwaRefreshButton (direto ou via PwaHeader).${RESET}`);
  process.exit(0);
}

console.log(`${RED}${BOLD}⚠️  ${missing.length} página(s) sem PwaRefreshButton:${RESET}`);
for (const r of missing) {
  console.log(`  ${RED}•${RESET} ${r.file}`);
}
console.log(`\n${DIM}Dica: importe \`PwaHeader\` (que já embute o refresh) ou adicione \`<PwaRefreshButton />\` diretamente no header da página.${RESET}`);
process.exit(1);
