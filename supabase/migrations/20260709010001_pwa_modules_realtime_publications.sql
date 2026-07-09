-- ============================================================
-- Habilita Realtime (publication supabase_realtime) nas tabelas
-- operacionais dos módulos do PWA que ainda não sincronizavam entre
-- dispositivos: alojamento, transporte, coordenação/resultados/registros,
-- credenciamento, delegação (protestos) e arbitragem — além de dois gaps
-- em alimentação (meal_consumptions_unlinked, service_voucher_uses) que já
-- eram assinados pelo frontend mas nunca recebiam nada.
--
-- Mesma causa raiz já corrigida para material_deliveries em
-- 20260708230000_material_realtime_publication.sql: o Supabase Realtime só
-- transmite mudanças de tabelas explicitamente adicionadas à publicação —
-- sem isso, cada aparelho só via os próprios dados mudarem (estado local
-- atualizado no momento da própria ação), nenhum aparelho via ao vivo o que
-- os outros operadores estavam registrando.
-- ============================================================
DO $$
DECLARE
  tbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime não encontrada — realtime indisponível neste banco.';
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY ARRAY[
    -- Alojamento
    'lodging_occupancies',
    'lodging_units',
    'lodging_locations',
    -- Transporte
    'transport_passengers',
    'transport_trips',
    -- Coordenação (incidentes compartilhados com transporte/alojamento)
    'operational_incidents',
    -- Coordenação / Resultados / Registros
    'competition_matches',
    'competition_match_results',
    'match_scores',
    'match_officials',
    'match_attachments',
    -- Arbitragem
    'match_user_assignments',
    'referee_profiles',
    -- Credenciamento
    'external_credentials',
    'participant_event_stages',
    -- Delegação (protestos)
    'protests',
    'protest_attachments',
    'protest_audit_log',
    -- Alimentação (gaps já assinados pelo frontend, sem publication)
    'meal_consumptions_unlinked',
    'service_voucher_uses'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
