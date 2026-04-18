#!/usr/bin/env npx tsx
/**
 * E2E — Prova Individual (Atletismo Pista/Campo)
 * Executa os 12 passos do checklist docs/checklists/e2e-prova-individual.md
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
  const fakeUid = "00000000-0000-0000-0000-000000000001";

  // Shared state
  let eventId = "";
  let sportId = "";
  let categoryId = "";
  let venueId = "";
  let sportEventId = "";
  let phaseId = "";
  let groupAId = "";
  let groupBId = "";
  let matchAId = "";
  let matchBId = "";
  let instId = "";
  let delId = "";
  const participants: { id: string; name: string; pseId: string }[] = [];
  const entriesByMatch: Record<string, { entryId: string; pseId: string; name: string }[]> = {};
  let bulletinId = "";

  // ── Passo 0: Pré-requisitos ──────────────────────────────────────
  steps.push(
    await runStep(0, "Criar pré-requisitos", async () => {
      const { data: ev } = await sb
        .from("events")
        .insert({ name: `${E2E_PREFIX} Evento Individual`, slug: `e2e-ind-${uid.slice(0, 8)}`, year: 2026, status: "active" })
        .select("id")
        .single();
      eventId = ev!.id;

      const { data: sp } = await sb
        .from("sports")
        .insert({ name: `${E2E_PREFIX} Atletismo`, slug: `e2e-atl-${uid.slice(0, 8)}`, event_id: eventId })
        .select("id")
        .single();
      sportId = sp!.id;

      const { data: cat } = await sb
        .from("categories")
        .insert({ name: `${E2E_PREFIX} Juvenil`, slug: `e2e-juv-ind-${uid.slice(0, 8)}`, event_id: eventId, gender_scope: "masculino" })
        .select("id")
        .single();
      categoryId = cat!.id;

      const { data: vn } = await sb
        .from("venues")
        .insert({ name: `${E2E_PREFIX} Pista`, event_id: eventId })
        .select("id")
        .single();
      venueId = vn!.id;

      const { data: inst } = await sb
        .from("institutions")
        .insert({ name: `${E2E_PREFIX} Escola Ind`, slug: `e2e-esc-ind-${uid.slice(0, 8)}` })
        .select("id")
        .single();
      instId = inst!.id;

      const { data: del } = await sb
        .from("delegations")
        .insert({ event_id: eventId, institution_id: instId, status: "confirmed" })
        .select("id")
        .single();
      delId = del!.id;

      // Create 6 participants (people + participants + pse)
      for (let i = 1; i <= 6; i++) {
        const pName = `${E2E_PREFIX} Atleta ${i}`;
        const { data: person } = await sb
          .from("people")
          .insert({ full_name: pName, birth_date: "2008-01-01" })
          .select("id")
          .single();

        const { data: part } = await sb
          .from("participants")
          .insert({
            event_id: eventId,
            person_id: person!.id,
            delegation_id: delId,
            role: "atleta",
            status: "confirmed",
          })
          .select("id")
          .single();

        participants.push({ id: part!.id, name: pName, pseId: "" });
      }

      return `event=${eventId}, ${participants.length} atletas`;
    })
  );

  // ── Passo 1: Criar Prova (sport_event) ───────────────────────────
  steps.push(
    await runStep(1, "Criar sport_event (100m)", async () => {
      const { data, error } = await sb
        .from("sport_events")
        .insert({
          event_id: eventId,
          sport_id: sportId,
          category_id: categoryId,
          gender: "masculino",
          name: `${E2E_PREFIX} 100m Juvenil Masc`,
        })
        .select("id")
        .single();
      if (error) throw error;
      sportEventId = data.id;

      // Register PSEs
      for (const p of participants) {
        const { data: pse } = await sb
          .from("participant_sport_events")
          .insert({ participant_id: p.id, sport_event_id: sportEventId, event_id: eventId, status: "confirmed" })
          .select("id")
          .single();
        p.pseId = pse!.id;
      }

      return `sport_event=${sportEventId}`;
    })
  );

  // ── Passo 2: Configurar Regras ───────────────────────────────────
  steps.push(
    await runStep(2, "Configurar regras (family=time)", async () => {
      const { error } = await sb.from("sport_event_rules").insert({
        sport_event_id: sportEventId,
        event_id: eventId,
        family: "time",
        format: "heats",
        participation_mode: "individual",
        rules: { lower_is_better: true, max_attempts: 1 },
      });
      if (error) throw error;
      return "family=time, format=heats";
    })
  );

  // ── Passo 3: Criar Baterias (Heats) ─────────────────────────────
  steps.push(
    await runStep(3, "Criar fase + 2 séries", async () => {
      const { data: ph } = await sb
        .from("competition_phases")
        .insert({
          name: `${E2E_PREFIX} Baterias`,
          sport_event_id: sportEventId,
          event_id: eventId,
          phase_type: "heats",
          sort_order: 1,
          status: "in_progress",
        })
        .select("id")
        .single();
      phaseId = ph!.id;

      const { data: gA } = await sb
        .from("competition_groups")
        .insert({ name: `${E2E_PREFIX} Série 1`, phase_id: phaseId, event_id: eventId, sort_order: 1 })
        .select("id")
        .single();
      groupAId = gA!.id;

      const { data: gB } = await sb
        .from("competition_groups")
        .insert({ name: `${E2E_PREFIX} Série 2`, phase_id: phaseId, event_id: eventId, sort_order: 2 })
        .select("id")
        .single();
      groupBId = gB!.id;

      return `phase=${phaseId}, series=[${groupAId}, ${groupBId}]`;
    })
  );

  // ── Passo 4: Distribuir Atletas nas Séries ───────────────────────
  steps.push(
    await runStep(4, "Gerar partidas e distribuir atletas", async () => {
      // Match for Série 1
      const { data: mA } = await sb
        .from("competition_matches")
        .insert({
          event_id: eventId,
          phase_id: phaseId,
          group_id: groupAId,
          sport_event_id: sportEventId,
          match_number: 1,
          status: "scheduled",
        })
        .select("id")
        .single();
      matchAId = mA!.id;

      // Match for Série 2
      const { data: mB } = await sb
        .from("competition_matches")
        .insert({
          event_id: eventId,
          phase_id: phaseId,
          group_id: groupBId,
          sport_event_id: sportEventId,
          match_number: 2,
          status: "scheduled",
        })
        .select("id")
        .single();
      matchBId = mB!.id;

      entriesByMatch[matchAId] = [];
      entriesByMatch[matchBId] = [];

      // Distribute: first 3 to série 1, next 3 to série 2
      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        const mId = i < 3 ? matchAId : matchBId;
        const { data: entry } = await sb
          .from("competition_match_entries")
          .insert({ match_id: mId, participant_sport_event_id: p.pseId, side: `lane_${i + 1}` })
          .select("id")
          .single();
        entriesByMatch[mId].push({ entryId: entry!.id, pseId: p.pseId, name: p.name });
      }

      return `match1=${matchAId}(3 atletas), match2=${matchBId}(3 atletas)`;
    })
  );

  // ── Passo 5: Agendar ─────────────────────────────────────────────
  steps.push(
    await runStep(5, "Agendar séries", async () => {
      await sb.from("competition_matches").update({ match_date: "2026-06-16", start_time: "08:00", venue_id: venueId }).eq("id", matchAId);
      await sb.from("competition_matches").update({ match_date: "2026-06-16", start_time: "08:30", venue_id: venueId }).eq("id", matchBId);
      return "Série 1: 08:00, Série 2: 08:30";
    })
  );

  // ── Passo 6: Lançar Tempos (Série 1) ─────────────────────────────
  // Times in ms: Atleta1=11200, Atleta2=11500, Atleta3=11800
  const timesA = [11200, 11500, 11800];
  steps.push(
    await runStep(6, "Lançar tempos Série 1", async () => {
      for (let i = 0; i < entriesByMatch[matchAId].length; i++) {
        const e = entriesByMatch[matchAId][i];
        await sb.from("competition_match_results").insert({
          match_id: matchAId,
          match_entry_id: e.entryId,
          time_ms: timesA[i],
          result_status: "resultado_lancado",
          recorded_by: fakeUid,
          position: i + 1,
        });
      }
      await sb.from("competition_matches").update({ status: "finished" }).eq("id", matchAId);
      return `Tempos: ${timesA.join(", ")}ms`;
    })
  );

  // ── Passo 7: Lançar Tempos (Série 2) ─────────────────────────────
  // Times: Atleta4=11100, Atleta5=11400, Atleta6=12000
  const timesB = [11100, 11400, 12000];
  steps.push(
    await runStep(7, "Lançar tempos Série 2", async () => {
      for (let i = 0; i < entriesByMatch[matchBId].length; i++) {
        const e = entriesByMatch[matchBId][i];
        await sb.from("competition_match_results").insert({
          match_id: matchBId,
          match_entry_id: e.entryId,
          time_ms: timesB[i],
          result_status: "resultado_lancado",
          recorded_by: fakeUid,
          position: i + 1,
        });
      }
      await sb.from("competition_matches").update({ status: "finished" }).eq("id", matchBId);
      return `Tempos: ${timesB.join(", ")}ms`;
    })
  );

  // ── Passo 8: Verificar Ranking por Bateria ───────────────────────
  steps.push(
    await runStep(8, "Verificar ranking por bateria", async () => {
      const { data: resA } = await sb
        .from("competition_match_results")
        .select("time_ms, position")
        .eq("match_id", matchAId)
        .order("time_ms", { ascending: true });
      // Should be ordered: 11200, 11500, 11800
      if (resA![0].time_ms !== 11200) throw new Error("Série 1 ranking incorreto");

      const { data: resB } = await sb
        .from("competition_match_results")
        .select("time_ms, position")
        .eq("match_id", matchBId)
        .order("time_ms", { ascending: true });
      if (resB![0].time_ms !== 11100) throw new Error("Série 2 ranking incorreto");

      return "Rankings por bateria corretos";
    })
  );

  // ── Passo 9: Consolidar Ranking Cross-Heat ───────────────────────
  steps.push(
    await runStep(9, "Verificar ranking cross-heat", async () => {
      // Fetch all results for this sport_event via both matches
      const { data: allResults } = await sb
        .from("competition_match_results")
        .select("time_ms, match_entry_id")
        .in("match_id", [matchAId, matchBId])
        .not("time_ms", "is", null)
        .order("time_ms", { ascending: true });

      if (!allResults || allResults.length !== 6) {
        throw new Error(`Expected 6 results, got ${allResults?.length}`);
      }

      // Expected order: 11100, 11200, 11400, 11500, 11800, 12000
      const expected = [11100, 11200, 11400, 11500, 11800, 12000];
      for (let i = 0; i < expected.length; i++) {
        if (allResults[i].time_ms !== expected[i]) {
          throw new Error(
            `Cross-heat pos ${i + 1}: expected ${expected[i]}ms, got ${allResults[i].time_ms}ms`
          );
        }
      }
      return `Cross-heat: ${expected.join(", ")}ms ✓`;
    })
  );

  // ── Passo 10: Validar resultados ─────────────────────────────────
  steps.push(
    await runStep(10, "Validar resultados", async () => {
      const { error } = await sb
        .from("competition_match_results")
        .update({ result_status: "resultado_validado", validated_by: fakeUid, validated_at: new Date().toISOString() })
        .in("match_id", [matchAId, matchBId]);
      if (error) throw error;
      return "Todos validados";
    })
  );

  // ── Passo 11: Publicar com Boletim ───────────────────────────────
  steps.push(
    await runStep(11, "Publicar com boletim", async () => {
      const { data: bul } = await sb
        .from("official_bulletins")
        .insert({ event_id: eventId, title: `${E2E_PREFIX} Boletim 100m`, status: "publicado", published_at: new Date().toISOString() })
        .select("id")
        .single();
      bulletinId = bul!.id;

      const { error } = await sb
        .from("competition_match_results")
        .update({ result_status: "publicado", published_by: fakeUid, published_at: new Date().toISOString(), published_bulletin_id: bulletinId })
        .in("match_id", [matchAId, matchBId]);
      if (error) throw error;
      return `bulletin=${bulletinId}`;
    })
  );

  // ── Passo 12: Verificar publicação final ─────────────────────────
  steps.push(
    await runStep(12, "Verificar publicação final", async () => {
      const { data } = await sb
        .from("competition_match_results")
        .select("result_status")
        .in("match_id", [matchAId, matchBId]);
      const allPub = data?.every((r) => r.result_status === "publicado");
      if (!allPub) throw new Error("Nem todos publicados");
      return `${data?.length} resultados publicados`;
    })
  );

  // ── Cleanup ──────────────────────────────────────────────────────
  if (CLEANUP_FLAG && eventId) {
    await cleanupTestData(sb, eventId);
  }

  const report = buildReport("e2e-prova-individual", steps, startedAt);
  printReport(report);
  flushLog("prova-individual");
  return report;
}

main()
  .then((r) => process.exit(r.failed > 0 ? 1 : 0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(2);
  });

export { main };
