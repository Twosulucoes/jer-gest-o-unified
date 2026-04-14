#!/usr/bin/env npx tsx
/**
 * E2E — Prova Coletiva (Futsal/Handebol)
 * Executa os 12 passos do checklist docs/checklists/e2e-prova-coletiva.md
 */
import {
  E2E_PREFIX,
  CLEANUP_FLAG,
  getServiceClient,
  log,
  flushLog,
  runStep,
  buildReport,
  printReport,
  cleanupTestData,
  type StepResult,
  type TestReport,
} from "./e2e-helpers";

async function main(): Promise<TestReport> {
  const sb = getServiceClient();
  const startedAt = new Date();
  const steps: StepResult[] = [];
  const uid = crypto.randomUUID();

  // Shared state across steps
  let eventId = "";
  let sportId = "";
  let categoryId = "";
  let venueId = "";
  let sportEventId = "";
  let phaseId = "";
  let groupId = "";
  let matchId = "";
  let entryAId = "";
  let entryBId = "";
  let teamAId = "";
  let teamBId = "";
  let instAId = "";
  let instBId = "";
  let delAId = "";
  let delBId = "";
  let bulletinId = "";

  // ── Passo 0: Pré-requisitos ──────────────────────────────────────
  steps.push(
    await runStep(0, "Criar pré-requisitos (evento, modalidade, categoria, instituições, delegações)", async () => {
      // Event
      const { data: ev, error: evErr } = await sb
        .from("events")
        .insert({ name: `${E2E_PREFIX} Evento Coletivo`, slug: `e2e-col-${uid.slice(0, 8)}`, year: 2026, status: "active" })
        .select("id")
        .single();
      if (evErr) throw evErr;
      eventId = ev.id;

      // Sport
      const { data: sp, error: spErr } = await sb
        .from("sports")
        .insert({ name: `${E2E_PREFIX} Futsal`, slug: `e2e-futsal-${uid.slice(0, 8)}`, event_id: eventId })
        .select("id")
        .single();
      if (spErr) throw spErr;
      sportId = sp.id;

      // Category
      const { data: cat, error: catErr } = await sb
        .from("categories")
        .insert({ name: `${E2E_PREFIX} Juvenil`, slug: `e2e-juv-${uid.slice(0, 8)}`, event_id: eventId, gender_scope: "masculino" })
        .select("id")
        .single();
      if (catErr) throw catErr;
      categoryId = cat.id;

      // Venue
      const { data: vn, error: vnErr } = await sb
        .from("venues")
        .insert({ name: `${E2E_PREFIX} Ginásio`, event_id: eventId })
        .select("id")
        .single();
      if (vnErr) throw vnErr;
      venueId = vn.id;

      // Institutions
      const { data: iA } = await sb
        .from("institutions")
        .insert({ name: `${E2E_PREFIX} Escola A`, slug: `e2e-esc-a-${uid.slice(0, 8)}` })
        .select("id")
        .single();
      instAId = iA!.id;
      const { data: iB } = await sb
        .from("institutions")
        .insert({ name: `${E2E_PREFIX} Escola B`, slug: `e2e-esc-b-${uid.slice(0, 8)}` })
        .select("id")
        .single();
      instBId = iB!.id;

      // Delegations
      const { data: dA } = await sb
        .from("delegations")
        .insert({ event_id: eventId, institution_id: instAId, status: "confirmed" })
        .select("id")
        .single();
      delAId = dA!.id;
      const { data: dB } = await sb
        .from("delegations")
        .insert({ event_id: eventId, institution_id: instBId, status: "confirmed" })
        .select("id")
        .single();
      delBId = dB!.id;

      return `event=${eventId}`;
    })
  );

  // ── Passo 1: Criar Prova (sport_event) ───────────────────────────
  steps.push(
    await runStep(1, "Criar sport_event", async () => {
      const { data, error } = await sb
        .from("sport_events")
        .insert({
          event_id: eventId,
          sport_id: sportId,
          category_id: categoryId,
          gender: "masculino",
          name: `${E2E_PREFIX} Futsal Juvenil Masc`,
        })
        .select("id")
        .single();
      if (error) throw error;
      sportEventId = data.id;
      return `sport_event=${sportEventId}`;
    })
  );

  // ── Passo 2: Inscrever Equipes ───────────────────────────────────
  steps.push(
    await runStep(2, "Criar equipes", async () => {
      const { data: tA, error: eA } = await sb
        .from("teams")
        .insert({ name: `${E2E_PREFIX} Time A`, sport_event_id: sportEventId, delegation_id: delAId, event_id: eventId })
        .select("id")
        .single();
      if (eA) throw eA;
      teamAId = tA.id;

      const { data: tB, error: eB } = await sb
        .from("teams")
        .insert({ name: `${E2E_PREFIX} Time B`, sport_event_id: sportEventId, delegation_id: delBId, event_id: eventId })
        .select("id")
        .single();
      if (eB) throw eB;
      teamBId = tB.id;
      return `teamA=${teamAId}, teamB=${teamBId}`;
    })
  );

  // ── Passo 3: Estruturar Grupos ───────────────────────────────────
  steps.push(
    await runStep(3, "Criar fase e grupo", async () => {
      const { data: ph, error: phErr } = await sb
        .from("competition_phases")
        .insert({
          name: `${E2E_PREFIX} Fase de Grupos`,
          sport_event_id: sportEventId,
          event_id: eventId,
          phase_type: "group_stage",
          sort_order: 1,
          status: "in_progress",
        })
        .select("id")
        .single();
      if (phErr) throw phErr;
      phaseId = ph.id;

      const { data: gr, error: grErr } = await sb
        .from("competition_groups")
        .insert({ name: `${E2E_PREFIX} Grupo A`, phase_id: phaseId, event_id: eventId, sort_order: 1 })
        .select("id")
        .single();
      if (grErr) throw grErr;
      groupId = gr.id;

      // Sorteio
      await sb.from("group_draw_lots").insert([
        { group_id: groupId, team_id: teamAId, seed: 1 },
        { group_id: groupId, team_id: teamBId, seed: 2 },
      ]);

      return `phase=${phaseId}, group=${groupId}`;
    })
  );

  // ── Passo 4: Gerar Partida ───────────────────────────────────────
  steps.push(
    await runStep(4, "Gerar partida", async () => {
      const { data: m, error: mErr } = await sb
        .from("competition_matches")
        .insert({
          event_id: eventId,
          phase_id: phaseId,
          group_id: groupId,
          sport_event_id: sportEventId,
          match_number: 1,
          round_number: 1,
          status: "scheduled",
        })
        .select("id")
        .single();
      if (mErr) throw mErr;
      matchId = m.id;

      // Entries
      const { data: eA } = await sb
        .from("competition_match_entries")
        .insert({ match_id: matchId, team_id: teamAId, side: "home" })
        .select("id")
        .single();
      entryAId = eA!.id;
      const { data: eB } = await sb
        .from("competition_match_entries")
        .insert({ match_id: matchId, team_id: teamBId, side: "away" })
        .select("id")
        .single();
      entryBId = eB!.id;

      return `match=${matchId}`;
    })
  );

  // ── Passo 5: Agendar ─────────────────────────────────────────────
  steps.push(
    await runStep(5, "Agendar partida", async () => {
      const { error } = await sb
        .from("competition_matches")
        .update({ match_date: "2026-06-15", start_time: "09:00", venue_id: venueId })
        .eq("id", matchId);
      if (error) throw error;
      return "2026-06-15 09:00";
    })
  );

  // ── Passo 6: Designar Oficiais ───────────────────────────────────
  steps.push(
    await runStep(6, "Designar oficiais", async () => {
      const { error } = await sb
        .from("match_officials")
        .insert({ match_id: matchId, name: `${E2E_PREFIX} Árbitro`, role: "arbitro" });
      if (error) throw error;
      return "1 oficial";
    })
  );

  // ── Passo 7: Lançar Resultado ────────────────────────────────────
  steps.push(
    await runStep(7, "Lançar resultado (3×1)", async () => {
      // Use a fake user id for recorded_by
      const fakeUid = "00000000-0000-0000-0000-000000000001";
      const { error: rA } = await sb.from("competition_match_results").insert({
        match_id: matchId,
        match_entry_id: entryAId,
        score: "3",
        result_status: "resultado_lancado",
        recorded_by: fakeUid,
        outcome: "win",
        position: 1,
      });
      if (rA) throw rA;
      const { error: rB } = await sb.from("competition_match_results").insert({
        match_id: matchId,
        match_entry_id: entryBId,
        score: "1",
        result_status: "resultado_lancado",
        recorded_by: fakeUid,
        outcome: "loss",
        position: 2,
      });
      if (rB) throw rB;

      // Set match finished
      await sb.from("competition_matches").update({ status: "finished" }).eq("id", matchId);
      return "3×1 lançado";
    })
  );

  // ── Passo 8: Validar Resultado ───────────────────────────────────
  steps.push(
    await runStep(8, "Validar resultado", async () => {
      const fakeUid = "00000000-0000-0000-0000-000000000001";
      const { error } = await sb
        .from("competition_match_results")
        .update({
          result_status: "resultado_validado",
          validated_by: fakeUid,
          validated_at: new Date().toISOString(),
        })
        .eq("match_id", matchId);
      if (error) throw error;

      // Verify
      const { data } = await sb
        .from("competition_match_results")
        .select("result_status")
        .eq("match_id", matchId);
      const allValid = data?.every((r) => r.result_status === "resultado_validado");
      if (!allValid) throw new Error("Nem todos os resultados foram validados");
      return "resultado_validado";
    })
  );

  // ── Passo 9: Criar Boletim ──────────────────────────────────────
  steps.push(
    await runStep(9, "Criar boletim oficial", async () => {
      const { data, error } = await sb
        .from("official_bulletins")
        .insert({
          event_id: eventId,
          title: `${E2E_PREFIX} Boletim Coletivo`,
          status: "publicado",
          published_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      bulletinId = data.id;
      return `bulletin=${bulletinId}`;
    })
  );

  // ── Passo 10: Publicar Resultado ─────────────────────────────────
  steps.push(
    await runStep(10, "Publicar resultado com boletim", async () => {
      const fakeUid = "00000000-0000-0000-0000-000000000001";
      const { error } = await sb
        .from("competition_match_results")
        .update({
          result_status: "publicado",
          published_by: fakeUid,
          published_at: new Date().toISOString(),
          published_bulletin_id: bulletinId,
        })
        .eq("match_id", matchId);
      if (error) throw error;
      return "publicado";
    })
  );

  // ── Passo 11: Verificar Portal Público ───────────────────────────
  steps.push(
    await runStep(11, "Verificar resultado publicado", async () => {
      const { data, error } = await sb
        .from("competition_match_results")
        .select("result_status, published_bulletin_id")
        .eq("match_id", matchId);
      if (error) throw error;
      const allPub = data?.every(
        (r) => r.result_status === "publicado" && r.published_bulletin_id === bulletinId
      );
      if (!allPub) throw new Error("Resultados não estão publicados corretamente");
      return `${data?.length} resultados publicados`;
    })
  );

  // ── Passo 12: Verificar integridade referencial ──────────────────
  steps.push(
    await runStep(12, "Verificar integridade referencial", async () => {
      const { data: matches } = await sb
        .from("competition_matches")
        .select("id, status, event_id")
        .eq("id", matchId)
        .single();
      if (matches?.event_id !== eventId) throw new Error("event_id mismatch");
      if (matches?.status !== "finished") throw new Error("match not finished");

      const { data: entries } = await sb
        .from("competition_match_entries")
        .select("id, team_id")
        .eq("match_id", matchId);
      if (entries?.length !== 2) throw new Error(`Expected 2 entries, got ${entries?.length}`);
      return "Integridade OK";
    })
  );

  // ── Cleanup ──────────────────────────────────────────────────────
  if (CLEANUP_FLAG && eventId) {
    await cleanupTestData(sb, eventId);
  }

  const report = buildReport("e2e-prova-coletiva", steps, startedAt);
  printReport(report);
  flushLog("prova-coletiva");
  return report;
}

main()
  .then((r) => {
    process.exit(r.failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(2);
  });

export { main };
