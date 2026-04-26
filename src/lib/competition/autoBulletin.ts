import { supabase } from "@/integrations/supabase/client";

export type BulletinScope = "event" | "stage" | "sport_event";
export type BulletinStatusFilter = "publicado" | "resultado_validado";

export interface AutoBulletinFilters {
  eventId: string;
  scope: BulletinScope;
  /** Lista pré-resolvida de sport_event_ids da etapa (passar quando scope='stage'). */
  stageSportEventIds?: string[] | null;
  sportEventId?: string | null;
  statusFilter: BulletinStatusFilter;
  dateFrom?: string | null; // YYYY-MM-DD
  dateTo?: string | null;
  /** Quando informado, restringe às partidas dessa fase. */
  phaseId?: string | null;
  /** Sufixo opcional para o título sugerido (ex.: nome da fase). */
  titleSuffix?: string | null;
}

export interface AutoBulletinResult {
  contentMd: string;
  itemsCount: number;
  matchesCount: number;
  suggestedTitle: string;
  suggestedNumber: number;
  /** IDs das partidas (competition_matches) cujos resultados entraram no boletim. */
  matchIds: string[];
  /** IDs das provas (sport_events) representadas no boletim. */
  sportEventIds: string[];
}

interface MatchRow {
  id: string;
  match_number: number | null;
  match_date: string | null;
  start_time: string | null;
  sport_event_id: string | null;
  phase_id: string | null;
  venues: { name: string | null } | null;
  competition_phases: { name: string | null } | null;
  sport_events: {
    gender: string | null;
    sports: { name: string | null } | null;
    categories: { name: string | null } | null;
  } | null;
  competition_match_entries: Array<{
    id: string;
    side: string | null;
    teams: { name: string | null } | null;
    participant_sport_events: {
      participants: { people: { full_name: string | null } | null } | null;
    } | null;
    competition_match_results: Array<{
      score: string | null;
      outcome: string | null;
      result_status: string | null;
    }>;
  }>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "s/data";
  const parts = iso.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function entryLabel(e: MatchRow["competition_match_entries"][number], statusFilter: BulletinStatusFilter): string {
  const name =
    e.teams?.name ??
    e.participant_sport_events?.participants?.people?.full_name ??
    "—";
  const result = e.competition_match_results.find((r) => r.result_status === statusFilter)
    ?? e.competition_match_results[0];
  const score = result?.score ?? result?.outcome ?? "—";
  return `${name} (${score})`;
}

/**
 * Gera o conteúdo Markdown do Boletim Oficial automaticamente, agrupando
 * partidas com resultado pelo escopo solicitado.
 */
export async function buildAutoBulletinContent(filters: AutoBulletinFilters): Promise<AutoBulletinResult> {
  const {
    eventId, scope, stageSportEventIds, sportEventId, statusFilter,
    dateFrom, dateTo, phaseId, titleSuffix,
  } = filters;

  // Resolve sport_event_ids alvo conforme o escopo
  let sportEventIds: string[] | null = null;
  if (scope === "sport_event" && sportEventId) {
    sportEventIds = [sportEventId];
  } else if (scope === "stage") {
    sportEventIds = stageSportEventIds && stageSportEventIds.length > 0
      ? stageSportEventIds
      : ["00000000-0000-0000-0000-000000000000"]; // etapa sem provas → resultado vazio
  }

  // 1) Busca partidas com resultado no status solicitado
  let q = supabase
    .from("competition_matches")
    .select(`
      id, match_number, match_date, start_time, sport_event_id, phase_id,
      venues(name),
      competition_phases(name),
      sport_events!inner(
        gender,
        sports(name),
        categories(name)
      ),
      competition_match_entries(
        id, side,
        teams(name),
        participant_sport_events(participants(people(full_name))),
        competition_match_results(score, outcome, result_status)
      )
    `)
    .eq("event_id", eventId);

  if (sportEventIds) q = q.in("sport_event_id", sportEventIds);
  if (phaseId) q = q.eq("phase_id", phaseId);
  if (dateFrom) q = q.gte("match_date", dateFrom);
  if (dateTo) q = q.lte("match_date", dateTo);

  const { data, error } = await q.order("match_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("match_number", { ascending: true });

  if (error) throw error;

  const matches = ((data ?? []) as unknown as MatchRow[]).filter((m) =>
    m.competition_match_entries.some((e) =>
      e.competition_match_results.some((r) => r.result_status === statusFilter)
    )
  );

  // 2) Próximo número e nome do evento
  const [{ data: lastBulletin }, { data: eventRow }] = await Promise.all([
    supabase.from("official_bulletins").select("number").eq("event_id", eventId)
      .order("number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
  ]);

  const nextNumber = (lastBulletin?.number ?? 0) + 1;
  const eventName = eventRow?.name ?? "—";
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Boa_Vista" });
  const suggestedTitle = `Boletim Automático #${nextNumber} — ${today}`;

  // 3) Cabeçalho
  const lines: string[] = [];
  lines.push(`# Boletim Oficial #${nextNumber}`, "");
  lines.push(`**Evento:** ${eventName}`);
  lines.push(`**Emissão:** ${today}`);
  lines.push(`**Status incluído:** ${statusFilter === "publicado" ? "Publicados" : "Validados (pré-publicação)"}`);
  if (dateFrom || dateTo) {
    lines.push(`**Período:** ${dateFrom ?? "—"} a ${dateTo ?? "—"}`);
  }
  lines.push("", "---", "");

  if (matches.length === 0) {
    lines.push("> Nenhum resultado encontrado para os filtros informados.");
  }

  // 4) Agrupa por modalidade → fase
  let currentSport: string | null = null;
  let currentPhase: string | null = null;
  let itemsCount = 0;

  // Reordena por sport > category > phase para agrupamento estável
  matches.sort((a, b) => {
    const sa = `${a.sport_events?.sports?.name ?? ""}|${a.sport_events?.categories?.name ?? ""}|${a.sport_events?.gender ?? ""}`;
    const sb = `${b.sport_events?.sports?.name ?? ""}|${b.sport_events?.categories?.name ?? ""}|${b.sport_events?.gender ?? ""}`;
    if (sa !== sb) return sa.localeCompare(sb);
    const pa = a.competition_phases?.name ?? "";
    const pb = b.competition_phases?.name ?? "";
    if (pa !== pb) return pa.localeCompare(pb);
    return (a.match_date ?? "").localeCompare(b.match_date ?? "");
  });

  for (const m of matches) {
    const sport = m.sport_events?.sports?.name ?? "Modalidade";
    const cat = m.sport_events?.categories?.name;
    const gender = m.sport_events?.gender;
    const sectionKey = `${sport}${cat ? ` — ${cat}` : ""}${gender ? ` (${gender})` : ""}`;

    if (currentSport !== sectionKey) {
      lines.push("", `## ${sectionKey}`, "");
      currentSport = sectionKey;
      currentPhase = null;
    }

    const phase = m.competition_phases?.name ?? "Fase única";
    if (currentPhase !== phase) {
      lines.push("", `### ${phase}`, "");
      currentPhase = phase;
    }

    const entries = [...m.competition_match_entries].sort((a, b) =>
      (a.side ?? "").localeCompare(b.side ?? "")
    );
    const linePieces = entries.map((e) => entryLabel(e, statusFilter)).join(" x ");
    const dateStr = formatDate(m.match_date);
    const timeStr = m.start_time ? ` ${m.start_time.slice(0, 5)}` : "";
    const venueStr = m.venues?.name ? ` · ${m.venues.name}` : "";

    lines.push(`- **Partida #${m.match_number ?? "—"}** · ${dateStr}${timeStr}${venueStr} — ${linePieces}`);
    itemsCount++;
  }

  lines.push("", "---", "", "*Boletim gerado automaticamente. Revise antes de publicar.*");

  const matchIds = matches.map((m) => m.id);
  const usedSportEventIds = Array.from(
    new Set(matches.map((m) => m.sport_event_id).filter((id): id is string => !!id)),
  );

  return {
    contentMd: lines.join("\n"),
    itemsCount,
    matchesCount: matches.length,
    suggestedTitle,
    suggestedNumber: nextNumber,
    matchIds,
    sportEventIds: usedSportEventIds,
  };
}
