-- ============================================================
-- Sistema de Alertas Automáticos — Tabelas Base
-- ============================================================

-- ─── notifications ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  -- tipos: janela_abrindo | janela_encerrada | operador_inativo |
  --        sync_errors | sistema_offline | duplicidade
  title       text        NOT NULL,
  body        text        NOT NULL,
  data        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  read        boolean     NOT NULL DEFAULT false,
  push_sent   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON notifications (created_at DESC)
  WHERE push_sent = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuário vê/atualiza apenas as próprias notificações
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Edge Functions (service role) podem inserir
CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT WITH CHECK (true);

-- Habilita Realtime para push em tempo real no frontend
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- ─── alert_rules ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_rules (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type              text        NOT NULL UNIQUE,
  enabled           boolean     NOT NULL DEFAULT true,
  threshold_minutes int,
  threshold_count   int,
  notify_roles      text[]      NOT NULL DEFAULT '{}',
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_rules_select_staff" ON alert_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin', 'secretaria', 'coordenacao_tecnica')
    )
  );

CREATE POLICY "alert_rules_update_admin" ON alert_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Regras padrão
INSERT INTO alert_rules (type, enabled, threshold_minutes, threshold_count, notify_roles, description)
VALUES
  ('janela_abrindo',    true, 10,   null, '{"alimentacao","admin","secretaria"}',       'Aviso quando janela de refeição abre em X minutos'),
  ('janela_encerrada',  true, null, null, '{"alimentacao","admin","secretaria"}',        'Aviso quando janela de refeição é encerrada com contagem de consumos'),
  ('operador_inativo',  true, 10,   null, '{"admin","secretaria","coordenacao_tecnica"}','Aviso quando operador para de escanear durante janela ativa'),
  ('sync_errors',       true, null, 5,    '{"admin","secretaria"}',                      'Aviso quando há itens com erro na fila de sync (disparado pelo cliente)'),
  ('sistema_offline',   true, 2,    null, '{"alimentacao","transporte","alojamento","admin"}','Aviso quando sistema fica offline por X minutos (disparado pelo cliente)')
ON CONFLICT (type) DO NOTHING;
