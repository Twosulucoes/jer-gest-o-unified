import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { useUserSportLinks } from "@/hooks/useUserSportLinks";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalidadeItem {
  id: string;
  name: string;
  slug: string;
  sport: { name: string; is_collective: boolean } | null;
}

export interface EntradaPartida {
  id: string;
  side: string;
  team: { id: string; name: string } | null;
  participantName: string | null;
  score: { id: string; score_final: string | null; outcome: string | null } | null;
}

export interface PartidaItem {
  id: string;
  match_number: number | null;
  match_date: string | null;
  start_time: string | null;
  status: string;
  phase: { name: string } | null;
  group: { name: string } | null;
  sport_event_id: string | null;
  entries: EntradaPartida[];
}

export interface ArbitroItem {
  id: string;
  name: string;
  role: string;
  notes: string | null;
}

export interface AnexoItem {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  notes: string | null;
}

export const ROLES_ARBITRAGEM = [
  { value: "arbitro", label: "Árbitro" },
  { value: "mesario", label: "Mesário" },
  { value: "delegado_partida", label: "Delegado" },
  { value: "cronometrista", label: "Cronometrista" },
  { value: "anotador", label: "Anotador" },
  { value: "outro", label: "Outro" },
] as const;

export const TIPOS_ANEXO = [
  { value: "sumula", label: "Súmula" },
  { value: "foto", label: "Foto" },
  { value: "mini_relatorio", label: "Mini-Relatório" },
  { value: "evidencia", label: "Evidência" },
] as const;

// ─── Modalidades do coordenador ───────────────────────────────────────────────

export function useMinhasModalidades() {
  const eventId = useActiveEventId();
  const { sportIds, isLoading: linksLoading } = useUserSportLinks();

  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ["minhas-modalidades", eventId, sportIds],
    queryFn: async () => {
      if (!eventId) return [];
      let q = supabase
        .from("sport_events")
        .select("id, name, slug, sport:sports(name, is_collective)")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("name");

      if (sportIds && sportIds.length > 0) {
        q = q.in("sport_id", sportIds);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ModalidadeItem[];
    },
    enabled: !!eventId && !linksLoading,
  });

  return { modalidades, isLoading: isLoading || linksLoading };
}

// ─── Partidas de uma modalidade ───────────────────────────────────────────────

export function usePartidasModalidade(sportEventId: string | null) {
  const eventId = useActiveEventId();

  return useQuery({
    queryKey: ["partidas-modalidade", sportEventId, eventId],
    queryFn: async () => {
      if (!sportEventId || !eventId) return [];
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status, sport_event_id,
          phase:competition_phases(name),
          group:competition_groups(name),
          entries:competition_match_entries(
            id, side,
            team:teams(id, name),
            participant_sport_event:participant_sport_events(
              participant:participants(person:people(full_name))
            ),
            score:match_scores(id, score_final, outcome)
          )
        `)
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("match_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      return ((data ?? []) as unknown[]).map((m: unknown) => {
        const match = m as Record<string, unknown>;
        const rawEntries = (match.entries as unknown[]) ?? [];
        const entries: EntradaPartida[] = rawEntries.map((e: unknown) => {
          const entry = e as Record<string, unknown>;
          const pse = entry.participant_sport_event as Record<string, unknown> | null;
          const participant = pse?.participant as Record<string, unknown> | null;
          const person = participant?.person as Record<string, unknown> | null;
          const scores = entry.score as unknown[];
          return {
            id: entry.id as string,
            side: entry.side as string,
            team: entry.team as EntradaPartida["team"],
            participantName: (person?.full_name as string) ?? null,
            score: scores?.[0] as EntradaPartida["score"] ?? null,
          };
        });
        return {
          id: match.id as string,
          match_number: match.match_number as number | null,
          match_date: match.match_date as string | null,
          start_time: match.start_time as string | null,
          status: match.status as string,
          sport_event_id: match.sport_event_id as string | null,
          phase: match.phase as PartidaItem["phase"],
          group: match.group as PartidaItem["group"],
          entries,
        } satisfies PartidaItem;
      });
    },
    enabled: !!sportEventId && !!eventId,
  });
}

// ─── Detalhe de uma partida ───────────────────────────────────────────────────

export function usePartidaDetalhe(matchId: string | null) {
  return useQuery({
    queryKey: ["partida-detalhe", matchId],
    queryFn: async () => {
      if (!matchId) return null;
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status, sport_event_id, notes,
          phase:competition_phases(name),
          group:competition_groups(name),
          entries:competition_match_entries(
            id, side,
            team:teams(id, name),
            participant_sport_event:participant_sport_events(
              participant:participants(person:people(full_name))
            ),
            score:match_scores(id, score_final, outcome)
          )
        `)
        .eq("id", matchId)
        .single();
      if (error) throw error;
      const m = data as Record<string, unknown>;
      const rawEntries = (m.entries as unknown[]) ?? [];
      const entries: EntradaPartida[] = rawEntries.map((e: unknown) => {
        const entry = e as Record<string, unknown>;
        const pse = entry.participant_sport_event as Record<string, unknown> | null;
        const participant = pse?.participant as Record<string, unknown> | null;
        const person = participant?.person as Record<string, unknown> | null;
        const scores = entry.score as unknown[];
        return {
          id: entry.id as string,
          side: entry.side as string,
          team: entry.team as EntradaPartida["team"],
          participantName: (person?.full_name as string) ?? null,
          score: scores?.[0] as EntradaPartida["score"] ?? null,
        };
      });
      return {
        id: m.id as string,
        match_number: m.match_number as number | null,
        match_date: m.match_date as string | null,
        start_time: m.start_time as string | null,
        status: m.status as string,
        sport_event_id: m.sport_event_id as string | null,
        notes: m.notes as string | null,
        phase: m.phase as PartidaItem["phase"],
        group: m.group as PartidaItem["group"],
        entries,
      };
    },
    enabled: !!matchId,
  });
}

// ─── Árbitros da partida ──────────────────────────────────────────────────────

export function useArbitrosPartida(matchId: string | null) {
  return useQuery({
    queryKey: ["arbitros-partida", matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from("match_officials")
        .select("id, name, role, notes")
        .eq("match_id", matchId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ArbitroItem[];
    },
    enabled: !!matchId,
  });
}

export function useAdicionarArbitro(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; role: string; notes?: string }) => {
      const { error } = await supabase.from("match_officials").insert({
        match_id: matchId,
        name: payload.name,
        role: payload.role,
        notes: payload.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["arbitros-partida", matchId] });
      toast.success("Árbitro adicionado");
    },
    onError: () => toast.error("Erro ao adicionar árbitro"),
  });
}

export function useRemoverArbitro(matchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (officialId: string) => {
      const { error } = await supabase.from("match_officials").delete().eq("id", officialId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["arbitros-partida", matchId] });
      toast.success("Árbitro removido");
    },
    onError: () => toast.error("Erro ao remover árbitro"),
  });
}

// ─── Placar ───────────────────────────────────────────────────────────────────

export function useSalvarPlacar(matchId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const eventId = useActiveEventId();

  return useMutation({
    mutationFn: async (
      scores: Array<{ entryId: string; scoreFinal: string; outcome: string }>
    ) => {
      for (const s of scores) {
        const { error: scoreErr } = await supabase.from("match_scores").upsert(
          { match_id: matchId, match_entry_id: s.entryId, score_final: s.scoreFinal, outcome: s.outcome },
          { onConflict: "match_entry_id" }
        );
        if (scoreErr) throw scoreErr;

        if (user?.id && eventId) {
          const { error: resultErr } = await supabase.from("competition_match_results").upsert(
            {
              match_id: matchId,
              match_entry_id: s.entryId,
              score: s.scoreFinal,
              outcome: s.outcome,
              result_status: "resultado_lancado",
              recorded_by: user.id,
            },
            { onConflict: "match_entry_id" }
          );
          if (resultErr) throw resultErr;
        }
      }

      const { error: statusErr } = await supabase
        .from("competition_matches")
        .update({ status: "finalizada" })
        .eq("id", matchId)
        .in("status", ["agendada", "em_andamento"]);
      if (statusErr) throw statusErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partida-detalhe", matchId] });
      qc.invalidateQueries({ queryKey: ["partidas-modalidade"] });
      toast.success("Placar salvo com sucesso");
    },
    onError: () => toast.error("Erro ao salvar placar"),
  });
}

// ─── Publicar resultado ───────────────────────────────────────────────────────

export function usePublicarResultado(matchId: string) {
  const qc = useQueryClient();
  const eventId = useActiveEventId();

  return useMutation({
    mutationFn: async ({ sportEventId, boletimTitulo }: { sportEventId: string; boletimTitulo?: string }) => {
      if (!eventId) throw new Error("Evento não selecionado");

      let bulletinId: string | null = null;

      if (boletimTitulo) {
        const hoje = new Date().toLocaleDateString("pt-BR");
        const { data: bData, error: bErr } = await supabase.rpc("rpc_create_bulletin", {
          p_event_id: eventId,
          p_title: boletimTitulo,
          p_content_md: `Resultados de ${hoje}`,
        });
        if (bErr) throw bErr;
        bulletinId = (bData as Record<string, unknown>)?.bulletin_id as string ?? null;
      }

      const { error: valErr } = await supabase.rpc("rpc_validate_results_for_sport_event", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
      });
      if (valErr) throw valErr;

      if (bulletinId) {
        const { error: pubErr } = await supabase.rpc("rpc_publish_results_for_sport_event", {
          p_event_id: eventId,
          p_sport_event_id: sportEventId,
          p_bulletin_id: bulletinId,
        });
        if (pubErr) throw pubErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partida-detalhe", matchId] });
      qc.invalidateQueries({ queryKey: ["partidas-modalidade"] });
      toast.success("Resultado publicado no portal");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao publicar resultado");
    },
  });
}

// ─── Anexos ───────────────────────────────────────────────────────────────────

export function useAnexosPartida(matchId: string | null) {
  return useQuery({
    queryKey: ["anexos-partida", matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from("match_attachments")
        .select("id, file_name, file_url, file_type, notes")
        .eq("match_id", matchId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as AnexoItem[];
    },
    enabled: !!matchId,
  });
}

export function useUploadAnexo(matchId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, tipo, notes }: { file: File; tipo: string; notes?: string }) => {
      const ext = file.name.split(".").pop();
      const path = `${matchId}/${Date.now()}-${tipo}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("match-attachments")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("match-attachments").getPublicUrl(path);

      const { error: dbErr } = await supabase.from("match_attachments").insert({
        match_id: matchId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: tipo,
        notes: notes ?? null,
        uploaded_by: user?.id ?? null,
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anexos-partida", matchId] });
      toast.success("Arquivo anexado");
    },
    onError: () => toast.error("Erro ao anexar arquivo"),
  });
}

export function useDeleteAnexo(matchId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (anexoId: string) => {
      const { error } = await supabase.from("match_attachments").delete().eq("id", anexoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anexos-partida", matchId] });
      toast.success("Arquivo removido");
    },
    onError: () => toast.error("Erro ao remover arquivo"),
  });
}
