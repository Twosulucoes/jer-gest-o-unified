import { supabase } from "@/integrations/supabase/client";

export type ParticipantManualSearchRow = {
  participant_id: string;
  person_id: string;
  full_name: string;
  cpf: string | null;
  participant_type: string;
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
  const { data: parts, error: ptErr } = await supabase
    .from("participants")
    .select("id, person_id, participant_type")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .in("person_id", personIds)
    .limit(limit);

  if (ptErr || !parts?.length) return [];

  const byPerson = new Map(peopleRows.map((p) => [p.id, p]));

  return parts.map((pt) => {
    const person = byPerson.get(pt.person_id);
    return {
      participant_id: pt.id,
      person_id: pt.person_id,
      full_name: person?.full_name ?? "—",
      cpf: person?.cpf ?? null,
      participant_type: pt.participant_type,
    };
  });
}
