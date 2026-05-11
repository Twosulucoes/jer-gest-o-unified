-- ============================================================
-- Sistema de Alertas — Função process_alerts() + pg_cron
-- ============================================================
-- Detecta condições de alerta e insere notificações na tabela
-- notifications. Chamada via pg_cron (a cada minuto) quando
-- disponível, ou pela Edge Function process-alerts.
-- ============================================================

CREATE OR REPLACE FUNCTION process_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule_janela_abrindo   alert_rules%ROWTYPE;
  rule_janela_encerrada alert_rules%ROWTYPE;
  rule_operador_inativo alert_rules%ROWTYPE;
  window_rec    RECORD;
  operator_rec  RECORD;
  recipient_id  uuid;
  window_label  text;
  now_manaus    timestamp;
  inserted_total int := 0;
BEGIN
  -- Hora local em Manaus (BRT / UTC-4, sem ajuste de DST)
  now_manaus := (now() AT TIME ZONE 'America/Manaus')::timestamp;

  -- ────────────────────────────────────────────────────────
  -- TIPO 1 — Janela abrindo em threshold_minutes minutos
  -- ────────────────────────────────────────────────────────
  SELECT * INTO rule_janela_abrindo
    FROM alert_rules WHERE type = 'janela_abrindo' AND enabled;

  IF FOUND THEN
    FOR window_rec IN
      SELECT
        mw.id,
        mw.event_stage_id,
        mw.service_date,
        mw.start_time,
        mw.location,
        mt.name AS meal_type_name
      FROM meal_windows mw
      JOIN meal_types mt ON mt.id = mw.meal_type_id
      WHERE mw.is_active = true
        -- Janela abre dentro da janela de alerta (±1 min em torno do threshold)
        AND (mw.service_date::date + mw.start_time::time) BETWEEN
              now_manaus + (rule_janela_abrindo.threshold_minutes - 1) * interval '1 minute'
          AND now_manaus + (rule_janela_abrindo.threshold_minutes + 1) * interval '1 minute'
        -- Não alertamos duas vezes para a mesma janela nas últimas 20 min
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'janela_abrindo'
            AND (n.data->>'window_id') = mw.id::text
            AND n.created_at > now() - interval '20 minutes'
        )
    LOOP
      window_label := coalesce(window_rec.meal_type_name, 'Refeição');

      FOR recipient_id IN
        SELECT DISTINCT ur.user_id
        FROM user_roles ur
        WHERE ur.role::text = ANY(rule_janela_abrindo.notify_roles)
      LOOP
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          recipient_id,
          'janela_abrindo',
          '⏰ ' || window_label || ' em ' || rule_janela_abrindo.threshold_minutes || ' min',
          '⏰ ' || window_label || ' começa às ' ||
            to_char(window_rec.start_time::time, 'HH24:MI') ||
            CASE WHEN window_rec.location IS NOT NULL THEN ' — ' || window_rec.location ELSE '' END ||
            ' — prepare o scanner',
          jsonb_build_object(
            'window_id',       window_rec.id,
            'meal_type',       window_label,
            'start_time',      window_rec.start_time,
            'event_stage_id',  window_rec.event_stage_id
          )
        );
        inserted_total := inserted_total + 1;
      END LOOP;
    END LOOP;
  END IF;

  -- ────────────────────────────────────────────────────────
  -- TIPO 2 — Janela encerrada (encerrou no último minuto)
  -- ────────────────────────────────────────────────────────
  SELECT * INTO rule_janela_encerrada
    FROM alert_rules WHERE type = 'janela_encerrada' AND enabled;

  IF FOUND THEN
    FOR window_rec IN
      SELECT
        mw.id,
        mw.event_stage_id,
        mw.end_time,
        mt.name AS meal_type_name,
        COUNT(mc.id) AS consumption_count
      FROM meal_windows mw
      JOIN meal_types mt ON mt.id = mw.meal_type_id
      LEFT JOIN meal_consumptions mc ON mc.meal_window_id = mw.id
      WHERE mw.is_active = true
        AND (mw.service_date::date + mw.end_time::time) BETWEEN
              now_manaus - interval '1 minute'
          AND now_manaus
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'janela_encerrada'
            AND (n.data->>'window_id') = mw.id::text
            AND n.created_at > now() - interval '20 minutes'
        )
      GROUP BY mw.id, mw.event_stage_id, mw.end_time, mt.name
    LOOP
      window_label := coalesce(window_rec.meal_type_name, 'Refeição');

      FOR recipient_id IN
        SELECT DISTINCT ur.user_id
        FROM user_roles ur
        WHERE ur.role::text = ANY(rule_janela_encerrada.notify_roles)
      LOOP
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          recipient_id,
          'janela_encerrada',
          '✅ ' || window_label || ' encerrado',
          '✅ ' || window_label || ' encerrado — ' ||
            window_rec.consumption_count || ' refeições registradas',
          jsonb_build_object(
            'window_id',       window_rec.id,
            'meal_type',       window_label,
            'count',           window_rec.consumption_count,
            'event_stage_id',  window_rec.event_stage_id
          )
        );
        inserted_total := inserted_total + 1;
      END LOOP;
    END LOOP;
  END IF;

  -- ────────────────────────────────────────────────────────
  -- TIPO 3 — Operador inativo durante janela ativa
  -- ────────────────────────────────────────────────────────
  SELECT * INTO rule_operador_inativo
    FROM alert_rules WHERE type = 'operador_inativo' AND enabled;

  IF FOUND THEN
    FOR operator_rec IN
      SELECT
        ur.user_id      AS operator_id,
        p.full_name     AS operator_name,
        mw.id           AS window_id,
        mw.event_stage_id,
        COALESCE(
          EXTRACT(EPOCH FROM (now() - MAX(mc.created_at)))::int / 60,
          999
        ) AS minutes_since_scan
      FROM user_roles ur
      JOIN profiles p ON p.id = ur.user_id
      -- Janelas ativas agora
      CROSS JOIN meal_windows mw
      LEFT JOIN meal_consumptions mc
        ON mc.registered_by = ur.user_id::text
       AND mc.meal_window_id = mw.id
      WHERE ur.role = 'alimentacao'
        AND p.active = true
        AND mw.is_active = true
        AND (mw.service_date::date + mw.start_time::time) <= now_manaus
        AND (mw.service_date::date + mw.end_time::time)   >= now_manaus
      GROUP BY ur.user_id, p.full_name, mw.id, mw.event_stage_id
      HAVING
        COALESCE(
          EXTRACT(EPOCH FROM (now() - MAX(mc.created_at)))::int / 60,
          999
        ) >= rule_operador_inativo.threshold_minutes
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.type = 'operador_inativo'
            AND (n.data->>'operator_id') = ur.user_id::text
            AND (n.data->>'window_id')   = mw.id::text
            AND n.created_at > now() - interval '20 minutes'
        )
    LOOP
      FOR recipient_id IN
        SELECT DISTINCT ur2.user_id
        FROM user_roles ur2
        WHERE ur2.role::text = ANY(rule_operador_inativo.notify_roles)
      LOOP
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          recipient_id,
          'operador_inativo',
          '⚠️ Operador inativo',
          '⚠️ ' || coalesce(operator_rec.operator_name, 'Operador') ||
            ' parou de escanear há ' || operator_rec.minutes_since_scan || ' min',
          jsonb_build_object(
            'operator_id',    operator_rec.operator_id,
            'operator_name',  operator_rec.operator_name,
            'window_id',      operator_rec.window_id,
            'minutes',        operator_rec.minutes_since_scan,
            'event_stage_id', operator_rec.event_stage_id
          )
        );
        inserted_total := inserted_total + 1;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('inserted', inserted_total, 'ran_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION process_alerts() TO service_role;

-- ─── pg_cron (a cada minuto, se disponível) ───────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'jer_process_alerts';

    PERFORM cron.schedule(
      'jer_process_alerts',
      '* * * * *',
      $cron$ SELECT public.process_alerts(); $cron$
    );
    RAISE NOTICE 'pg_cron: jer_process_alerts agendado a cada minuto.';
  ELSE
    RAISE NOTICE 'pg_cron indisponível — process_alerts será chamado via Edge Function process-alerts.';
  END IF;
END $$;
