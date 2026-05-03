import { supabase } from "@/integrations/supabase/client";

export type ParticipantManualSearchRow = {
  participant_id: string;
  person_id: string;
  full_name: string;
  cpf: string | null;
  participant_type: string;
  is_active?: boolean;
  needs_meals?: boolean;
  credentialed_at?: string | null;
};

/** Remove caracteres que quebram filtros ILIKE do PostgREST. */
function sanitizeIlikeFragment(s: string) {
  return s.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Busca participantes ativos do evento por nome ou CPF (via `people`).
 * CPF com 11 dígitos usa igualdade; caso contrário, nome ILIKE e CPF parcial quando há ≥4 dígitos.
 */
export async function searchParticipantsByNameOrCpf(
  rawTerm: string,
  eventId: string,
  limit = 12,
  stageId?: string | null,
): Promise<ParticipantManualSearchRow[]> {
  const term = rawTerm.trim();
  if (term.length < 2) return [];

  const digits = term.replace(/\D/g, "");
  const isFullCpf = digits.length === 11;

  let peopleQuery = supabase.from("people").select("id, full_name, cpf").limit(35);

  if (isFullCpf) {
    const fmt = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    peopleQuery = peopleQuery.or(`cpf.eq.${digits},cpf.eq.${fmt}`);
  } else {
    const safe = sanitizeIlikeFragment(term);
    if (safe.length < 2) return [];
    const ors = [`full_name.ilike.%${safe}%`];
    if (digits.length >= 4) {
      ors.push(`cpf.ilike.%${digits}%`);
    }
    peopleQuery = peopleQuery.or(ors.join(","));
  }

  const { data: peopleRows, error: pErr } = await peopleQuery;
  if (pErr || !peopleRows?.length) return [];

  const personIds = peopleRows.map((p) => p.id);
  // Carrega também sinais de presença/elegibilidade (is_active, needs_meals,
  // credentialed_at) para que telas operacionais possam aplicar a "trava de
  // presença" no fluxo manual sem uma segunda viagem ao banco.
  const baseSelect = "id, person_id, participant_type, is_active, needs_meals, credentialed_at";
  let ptQuery = supabase
    .from("participants")
    .select(baseSelect)
    .eq("event_id", eventId)
    .eq("is_active", true)
    .in("person_id", personIds);

  if (stageId) {
    ptQuery = supabase
      .from("participants")
      .select(`${baseSelect}, participant_event_stages!inner(event_stage_id)`)
      .eq("event_id", eventId)
      .eq("is_active", true)
      .eq("participant_event_stages.event_stage_id", stageId)
      .in("person_id", personIds);
  }

  const { data: parts, error: ptErr } = await ptQuery.limit(limit);

  if (ptErr || !parts?.length) return [];

  const byPerson = new Map(peopleRows.map((p) => [p.id, p]));

  return parts.map((pt: any) => {
    const person = byPerson.get(pt.person_id);
    return {
      participant_id: pt.id,
      person_id: pt.person_id,
      full_name: person?.full_name ?? "—",
      cpf: person?.cpf ?? null,
      participant_type: pt.participant_type,
      is_active: pt.is_active ?? undefined,
      needs_meals: pt.needs_meals ?? undefined,
      credentialed_at: pt.credentialed_at ?? null,
    };
  });
}
