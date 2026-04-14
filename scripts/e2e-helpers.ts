/**
 * E2E Test Helpers — shared utilities for all E2E scripts.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── Types ──────────────────────────────────────────────────────────
export interface StepResult {
  step: number;
  name: string;
  status: "passed" | "failed" | "warning" | "skipped";
  durationMs: number;
  detail?: string;
  error?: string;
}

export interface TestReport {
  scriptName: string;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  steps: StepResult[];
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
}

// ── Constants ──────────────────────────────────────────────────────
export const E2E_PREFIX = "[E2E_TEST]";
export const CLEANUP_FLAG = process.argv.includes("--cleanup");

// ── Supabase client (service role) ─────────────────────────────────
export function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing env: SUPABASE_URL and SUPABASE_SERVICE_KEY are required"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Logger ─────────────────────────────────────────────────────────
let logLines: string[] = [];

export function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logLines.push(line);
}

export function flushLog(scriptName: string) {
  const dir = path.resolve(__dirname, "..", "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `e2e-${scriptName}-${ts}.log`);
  fs.writeFileSync(file, logLines.join("\n"), "utf-8");
  log(`Log written to ${file}`);
  const copy = [...logLines];
  logLines = [];
  return { file, lines: copy };
}

// ── Step runner ────────────────────────────────────────────────────
export async function runStep(
  step: number,
  name: string,
  fn: () => Promise<string | void>
): Promise<StepResult> {
  log(`── Passo ${step}: ${name} ──`);
  const t0 = Date.now();
  try {
    const detail = (await fn()) || "OK";
    const dur = Date.now() - t0;
    log(`   ✅ ${name} (${dur}ms) — ${detail}`);
    return { step, name, status: "passed", durationMs: dur, detail };
  } catch (err: any) {
    const dur = Date.now() - t0;
    const msg = err?.message || String(err);
    log(`   ❌ ${name} (${dur}ms) — ${msg}`);
    return { step, name, status: "failed", durationMs: dur, error: msg };
  }
}

// ── Report builder ─────────────────────────────────────────────────
export function buildReport(
  scriptName: string,
  steps: StepResult[],
  startedAt: Date
): TestReport {
  const now = new Date();
  return {
    scriptName,
    startedAt: startedAt.toISOString(),
    finishedAt: now.toISOString(),
    totalDurationMs: now.getTime() - startedAt.getTime(),
    steps,
    passed: steps.filter((s) => s.status === "passed").length,
    failed: steps.filter((s) => s.status === "failed").length,
    warnings: steps.filter((s) => s.status === "warning").length,
    skipped: steps.filter((s) => s.status === "skipped").length,
  };
}

export function printReport(r: TestReport) {
  log(`\n${"═".repeat(60)}`);
  log(`RELATÓRIO: ${r.scriptName}`);
  log(`Início: ${r.startedAt}  |  Fim: ${r.finishedAt}`);
  log(`Duração total: ${(r.totalDurationMs / 1000).toFixed(1)}s`);
  log(`Passos: ${r.steps.length} total | ✅ ${r.passed} | ❌ ${r.failed} | ⚠️ ${r.warnings} | ⏭️ ${r.skipped}`);
  log(`${"─".repeat(60)}`);
  for (const s of r.steps) {
    const icon =
      s.status === "passed" ? "✅" : s.status === "failed" ? "❌" : s.status === "warning" ? "⚠️" : "⏭️";
    log(`  ${icon} Passo ${s.step}: ${s.name} (${s.durationMs}ms)${s.error ? ` — ${s.error}` : ""}`);
  }
  log(`${"═".repeat(60)}\n`);
}

// ── Cleanup helper ─────────────────────────────────────────────────
export async function cleanupTestData(sb: SupabaseClient, eventId: string) {
  log("🧹 Limpando dados de teste...");
  // Order matters (FK constraints)
  const tables = [
    "match_attempts",
    "match_events",
    "match_penalties",
    "match_player_stats",
    "match_lineups",
    "match_discipline",
    "match_officials",
    "match_attachments",
    "competition_match_results",
    "competition_match_entries",
    "competition_matches",
    "group_draw_lots",
    "competition_groups",
    "competition_phases",
    "official_bulletins",
    "participant_sport_events",
    "teams",
    "team_members",
    "sport_events",
    "participant_credentials",
    "participants",
    "delegations",
    "categories",
    "sports",
    "venues",
    "institutions",
  ];
  for (const t of tables) {
    const { error } = await sb.from(t).delete().eq("event_id", eventId);
    if (error && !error.message.includes("event_id")) {
      // some tables don't have event_id, try match on notes or skip
    }
  }
  await sb.from("events").delete().eq("id", eventId);
  log("🧹 Limpeza concluída.");
}
