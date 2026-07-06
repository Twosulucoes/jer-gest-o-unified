-- Painel da Etapa (StageHomePage) — contagem de participantes e credenciados
-- direto no servidor.
--
-- Antes, o front baixava todas as linhas de participant_event_stages e
-- contava no browser (P.length). Isso estourava o limite default de 1000
-- linhas do PostgREST: uma etapa com 3.342 participantes aparecia como
-- "1000", e "credenciados" era calculado apenas sobre esses 1.000 IDs
-- (mostrando 832 em vez de 2.785). Contar no servidor elimina o teto e
-- ainda evita trafegar milhares de linhas para o navegador.
--
-- SECURITY INVOKER (default): preserva exatamente a visibilidade via RLS que
-- as queries diretas já tinham — nenhuma ampliação de escopo de leitura.

CREATE OR REPLACE FUNCTION public.get_stage_participation_counts(p_stage_id uuid)
RETURNS TABLE (participants integer, credentialed integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (
      SELECT count(DISTINCT pes.participant_id)::int
      FROM public.participant_event_stages pes
      WHERE pes.event_stage_id = p_stage_id
    ) AS participants,
    (
      SELECT count(DISTINCT pes.participant_id)::int
      FROM public.participant_event_stages pes
      JOIN public.participant_credentials pc
        ON pc.participant_id = pes.participant_id
       AND pc.status = 'active'
      WHERE pes.event_stage_id = p_stage_id
    ) AS credentialed;
$$;

REVOKE ALL ON FUNCTION public.get_stage_participation_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stage_participation_counts(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_stage_participation_counts(uuid) IS
  'Painel da Etapa: total de participantes (distintos) e credenciados (credencial ativa) de uma etapa, contados no servidor para não sofrer o teto de 1000 linhas do PostgREST.';
