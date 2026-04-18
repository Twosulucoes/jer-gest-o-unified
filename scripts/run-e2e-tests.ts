#!/usr/bin/env npx tsx
/**
 * Orquestrador E2E — executa todos os testes e gera relatório consolidado.
 *
 * Uso: npx tsx scripts/run-e2e-tests.ts [--cleanup]
 */
import { execSync } from "child_process";
import { log, flushLog } from "./e2e-helpers";

interface SuiteResult {
  script: string;
  exitCode: number;
  durationMs: number;
}

function run(script: string, cleanup: boolean): SuiteResult {
  const args = cleanup ? " --cleanup" : "";
  const cmd = `npx tsx scripts/${script}${args}`;
  log(`\n🚀 Executando: ${cmd}`);
  const t0 = Date.now();
  let exitCode = 0;
  try {
    execSync(cmd, { stdio: "inherit", env: process.env });
  } catch (err: any) {
    exitCode = err.status ?? 1;
  }
  return { script, exitCode, durationMs: Date.now() - t0 };
}

function main() {
  const cleanup = process.argv.includes("--cleanup");
  const startedAt = Date.now();

  log("╔══════════════════════════════════════════════════════════════╗");
  log("║          JER Gestão — Suite E2E Automatizada               ║");
  log("╚══════════════════════════════════════════════════════════════╝");

  const results: SuiteResult[] = [];
  results.push(run("e2e-prova-coletiva.ts", cleanup));
  results.push(run("e2e-prova-individual.ts", cleanup));

  const totalMs = Date.now() - startedAt;
  const passed = results.filter((r) => r.exitCode === 0).length;
  const failed = results.filter((r) => r.exitCode !== 0).length;

  log("\n╔══════════════════════════════════════════════════════════════╗");
  log("║                 RELATÓRIO CONSOLIDADO                       ║");
  log("╠══════════════════════════════════════════════════════════════╣");
  for (const r of results) {
    const icon = r.exitCode === 0 ? "✅" : "❌";
    log(`║ ${icon} ${r.script.padEnd(35)} ${(r.durationMs / 1000).toFixed(1).padStart(6)}s  exit=${r.exitCode}`);
  }
  log("╠══════════════════════════════════════════════════════════════╣");
  log(`║ Total: ${results.length} scripts | ✅ ${passed} passed | ❌ ${failed} failed | ${(totalMs / 1000).toFixed(1)}s`);
  log("╚══════════════════════════════════════════════════════════════╝");

  flushLog("consolidated");

  if (failed > 0) {
    log("\n🚨 FALHAS CRÍTICAS encontradas — verifique logs acima.");
    process.exit(1);
  } else {
    log("\n🎉 Todos os testes E2E passaram!");
    process.exit(0);
  }
}

main();
