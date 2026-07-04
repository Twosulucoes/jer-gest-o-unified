-- ============================================================
-- Pesquisa de Satisfação: exclusão de pesquisador e de pesquisa (evento)
--
-- RPCs SECURITY DEFINER que excluem de forma atômica, com verificação de papel
-- (admin/secretaria) e PROTEÇÃO de respostas: se houver respostas vinculadas,
-- a exclusão é bloqueada (retorna HAS_SURVEYS com a contagem) — respostas são o
-- dado valioso e não devem ser apagadas por engano.
--
-- Dependências (FKs em produção):
--   pesquisa_sessions.researcher_id / event_id  -> CASCADE  (somem sozinhas)
--   pesquisa_login_attempts.researcher_id       -> SET NULL (preserva auditoria)
--   pesquisa_surveys.researcher_id / event_id   -> RESTRICT (bloqueia; protegido aqui)
--   pesquisa_researchers.event_id               -> RESTRICT (por isso o evento
--                                                  remove seus pesquisadores antes)
-- ============================================================

CREATE OR REPLACE FUNCTION public.pesquisa_delete_researcher(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_surveys int;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role)) THEN
    RETURN json_build_object('error', 'FORBIDDEN');
  END IF;

  SELECT count(*) INTO v_surveys FROM pesquisa_surveys WHERE researcher_id = p_id;
  IF v_surveys > 0 THEN
    RETURN json_build_object('error', 'HAS_SURVEYS', 'count', v_surveys);
  END IF;

  -- sessões (CASCADE) e login_attempts (SET NULL) são tratadas pelas FKs
  DELETE FROM pesquisa_researchers WHERE id = p_id;
  RETURN json_build_object('status', 'deleted');
END;
$$;

CREATE OR REPLACE FUNCTION public.pesquisa_delete_event(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_surveys int;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaria'::app_role)) THEN
    RETURN json_build_object('error', 'FORBIDDEN');
  END IF;

  SELECT count(*) INTO v_surveys FROM pesquisa_surveys WHERE event_id = p_id;
  IF v_surveys > 0 THEN
    RETURN json_build_object('error', 'HAS_SURVEYS', 'count', v_surveys);
  END IF;

  -- pesquisadores do evento têm FK RESTRICT em event_id: removê-los antes
  -- (suas sessões saem por CASCADE); depois o próprio evento (sessões CASCADE).
  DELETE FROM pesquisa_researchers WHERE event_id = p_id;
  DELETE FROM pesquisa_events WHERE id = p_id;
  RETURN json_build_object('status', 'deleted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.pesquisa_delete_researcher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pesquisa_delete_event(uuid) TO authenticated;
