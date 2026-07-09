-- ============================================================
-- Gap encontrado ao ligar o realtime do frontend do módulo Alojamento
-- (ver 20260709010000_pwa_modules_realtime_publications.sql): as telas
-- de Ocorrências (AlojamentoIncidentesPage/AlojamentoNovoIncidentePage)
-- leem/gravam em `public.lodging_incidents` (via RPCs
-- get_alojamento_incidents/create_alojamento_incident, redefinidas em
-- 20260428034602 para o schema public), não em `operational_incidents`
-- (tabela usada pelos módulos de transporte/coordenação — feature
-- diferente). `lodging_incidents` não constava na lista de tabelas
-- adicionadas à publication, então uma assinatura `postgres_changes`
-- nela nunca receberia eventos.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime não encontrada — realtime indisponível neste banco.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'lodging_incidents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lodging_incidents;
  END IF;
END $$;
