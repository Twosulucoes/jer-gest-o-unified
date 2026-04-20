-- =====================================================
-- MÓDULO DE PROTESTO ONLINE (Delegação → CDE)
-- =====================================================

-- Sequência para o número de protocolo
CREATE SEQUENCE IF NOT EXISTS public.protest_protocol_seq START 1;

-- Tabela principal
CREATE TABLE public.protests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_number text NOT NULL UNIQUE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  delegation_id uuid NOT NULL REFERENCES public.delegations(id) ON DELETE RESTRICT,
  match_id uuid NOT NULL REFERENCES public.competition_matches(id) ON DELETE RESTRICT,
  sport_event_id uuid REFERENCES public.sport_events(id) ON DELETE SET NULL,

  fundamentation text NOT NULL,
  request text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,

  match_end_at timestamptz,
  deadline_at timestamptz NOT NULL,

  status text NOT NULL DEFAULT 'protocolado'
    CHECK (status IN ('protocolado','em_analise','aguardando_documentos','decidido','arquivado')),

  decision text CHECK (decision IS NULL OR decision IN ('deferido','indeferido','parcial')),
  decision_reason text,
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),

  disciplinary_case_id bigint REFERENCES public.disciplinary_cases(id) ON DELETE SET NULL,

  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_protests_event ON public.protests(event_id);
CREATE INDEX idx_protests_delegation ON public.protests(delegation_id);
CREATE INDEX idx_protests_match ON public.protests(match_id);
CREATE INDEX idx_protests_status ON public.protests(status);

-- Anexos
CREATE TABLE public.protest_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protest_id uuid NOT NULL REFERENCES public.protests(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_protest_attachments_protest ON public.protest_attachments(protest_id);

-- Auditoria
CREATE TABLE public.protest_audit_log (
  id bigserial PRIMARY KEY,
  protest_id uuid NOT NULL REFERENCES public.protests(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  old_value jsonb,
  new_value jsonb,
  notes text
);
CREATE INDEX idx_protest_audit_protest ON public.protest_audit_log(protest_id);

-- Triggers updated_at
CREATE TRIGGER update_protests_updated_at
  BEFORE UPDATE ON public.protests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_protest_attachments_updated_at
  BEFORE UPDATE ON public.protest_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.protests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protest_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protest_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: usuário pertence à delegação?
CREATE OR REPLACE FUNCTION public.user_belongs_to_delegation(_user_id uuid, _delegation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_delegations
    WHERE user_id = _user_id AND delegation_id = _delegation_id
  );
$$;

-- Protests policies
CREATE POLICY "Admin/CDE full access protests" ON public.protests
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')
    OR has_role(auth.uid(), 'cde') OR has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')
    OR has_role(auth.uid(), 'cde') OR has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Delegation reads own protests" ON public.protests
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_delegation(auth.uid(), delegation_id));

-- Attachments policies
CREATE POLICY "Admin/CDE full access protest attachments" ON public.protest_attachments
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')
    OR has_role(auth.uid(), 'cde') OR has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')
    OR has_role(auth.uid(), 'cde') OR has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Delegation reads own protest attachments" ON public.protest_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.protests p
      WHERE p.id = protest_attachments.protest_id
        AND public.user_belongs_to_delegation(auth.uid(), p.delegation_id)
    )
  );

CREATE POLICY "Delegation inserts own protest attachments" ON public.protest_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.protests p
      WHERE p.id = protest_attachments.protest_id
        AND public.user_belongs_to_delegation(auth.uid(), p.delegation_id)
        AND p.status IN ('protocolado','aguardando_documentos','em_analise')
    )
  );

-- Audit log policies (read only para delegação, full para admin/CDE)
CREATE POLICY "Admin/CDE read protest audit" ON public.protest_audit_log
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')
    OR has_role(auth.uid(), 'cde') OR has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Delegation reads own protest audit" ON public.protest_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.protests p
      WHERE p.id = protest_audit_log.protest_id
        AND public.user_belongs_to_delegation(auth.uid(), p.delegation_id)
    )
  );

-- =====================================================
-- Storage bucket privado
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('protestos','protestos', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {protest_id}/{filename}
CREATE POLICY "Admin/CDE full access protestos bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'protestos' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')
      OR has_role(auth.uid(), 'cde') OR has_role(auth.uid(), 'super_admin')
    )
  )
  WITH CHECK (
    bucket_id = 'protestos' AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')
      OR has_role(auth.uid(), 'cde') OR has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Delegation reads own protestos files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'protestos' AND EXISTS (
      SELECT 1 FROM public.protests p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.user_belongs_to_delegation(auth.uid(), p.delegation_id)
    )
  );

CREATE POLICY "Delegation uploads own protestos files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'protestos' AND EXISTS (
      SELECT 1 FROM public.protests p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.user_belongs_to_delegation(auth.uid(), p.delegation_id)
        AND p.status IN ('protocolado','aguardando_documentos','em_analise')
    )
  );

-- =====================================================
-- RPC: Criar protesto
-- =====================================================
CREATE OR REPLACE FUNCTION public.rpc_create_protest(
  p_match_id uuid,
  p_fundamentation text,
  p_request text,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL
)
RETURNS public.protests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_delegation_id uuid;
  v_match RECORD;
  v_deadline timestamptz;
  v_protocol text;
  v_protest public.protests;
  v_year int;
  v_seq bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_fundamentation IS NULL OR length(trim(p_fundamentation)) < 10 THEN
    RAISE EXCEPTION 'Fundamentação obrigatória (mínimo 10 caracteres)';
  END IF;
  IF p_request IS NULL OR length(trim(p_request)) < 5 THEN
    RAISE EXCEPTION 'Pedido obrigatório (mínimo 5 caracteres)';
  END IF;

  -- Pega delegação do usuário
  SELECT delegation_id INTO v_delegation_id
  FROM public.user_delegations WHERE user_id = v_user LIMIT 1;

  IF v_delegation_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a nenhuma delegação';
  END IF;

  -- Carrega partida
  SELECT m.*, m.event_id AS ev_id, m.sport_event_id AS se_id, m.end_time AS m_end
  INTO v_match
  FROM public.competition_matches m WHERE m.id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada';
  END IF;

  -- Verifica que a delegação participou da partida via teams
  IF NOT EXISTS (
    SELECT 1
    FROM public.competition_match_entries e
    JOIN public.teams t ON t.id = e.team_id
    WHERE e.match_id = p_match_id AND t.delegation_id = v_delegation_id
  ) THEN
    RAISE EXCEPTION 'Sua delegação não participou desta partida';
  END IF;

  -- Prazo: 60 minutos após end_time
  IF v_match.m_end IS NULL THEN
    RAISE EXCEPTION 'Partida ainda não foi encerrada';
  END IF;
  v_deadline := v_match.m_end + interval '60 minutes';

  IF now() > v_deadline THEN
    RAISE EXCEPTION 'Prazo encerrado em %', to_char(v_deadline AT TIME ZONE 'America/Boa_Vista','DD/MM/YYYY HH24:MI');
  END IF;

  -- Gera protocolo PRT-AAAA-NNNNNN
  v_year := extract(year from now())::int;
  v_seq := nextval('public.protest_protocol_seq');
  v_protocol := 'PRT-' || v_year::text || '-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.protests (
    protocol_number, event_id, delegation_id, match_id, sport_event_id,
    fundamentation, request, contact_name, contact_phone, contact_email,
    match_end_at, deadline_at, status, created_by
  ) VALUES (
    v_protocol, v_match.ev_id, v_delegation_id, p_match_id, v_match.se_id,
    trim(p_fundamentation), trim(p_request), p_contact_name, p_contact_phone, p_contact_email,
    v_match.m_end, v_deadline, 'protocolado', v_user
  ) RETURNING * INTO v_protest;

  INSERT INTO public.protest_audit_log (protest_id, action, performed_by, new_value, notes)
  VALUES (v_protest.id, 'created', v_user, to_jsonb(v_protest), 'Protocolo criado pela delegação');

  RETURN v_protest;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_protest(uuid,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_create_protest(uuid,text,text,text,text,text) TO authenticated;

-- =====================================================
-- RPC: Decidir protesto
-- =====================================================
CREATE OR REPLACE FUNCTION public.rpc_decide_protest(
  p_protest_id uuid,
  p_decision text,
  p_decision_reason text,
  p_new_status text DEFAULT 'decidido'
)
RETURNS public.protests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_protest public.protests;
  v_old jsonb;
BEGIN
  IF NOT (has_role(v_user,'admin') OR has_role(v_user,'secretaria')
         OR has_role(v_user,'cde') OR has_role(v_user,'super_admin')) THEN
    RAISE EXCEPTION 'Permissão negada' USING ERRCODE = '42501';
  END IF;

  IF p_decision IS NOT NULL AND p_decision NOT IN ('deferido','indeferido','parcial') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  IF p_new_status NOT IN ('protocolado','em_analise','aguardando_documentos','decidido','arquivado') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  IF p_new_status = 'decidido' THEN
    IF p_decision IS NULL THEN
      RAISE EXCEPTION 'Decisão obrigatória ao finalizar';
    END IF;
    IF p_decision_reason IS NULL OR length(trim(p_decision_reason)) < 10 THEN
      RAISE EXCEPTION 'Fundamentação da decisão obrigatória (mínimo 10 caracteres)';
    END IF;
  END IF;

  SELECT to_jsonb(p.*) INTO v_old FROM public.protests p WHERE id = p_protest_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Protesto não encontrado'; END IF;

  UPDATE public.protests SET
    status = p_new_status,
    decision = COALESCE(p_decision, decision),
    decision_reason = COALESCE(p_decision_reason, decision_reason),
    decided_at = CASE WHEN p_new_status = 'decidido' THEN now() ELSE decided_at END,
    decided_by = CASE WHEN p_new_status = 'decidido' THEN v_user ELSE decided_by END,
    updated_at = now()
  WHERE id = p_protest_id
  RETURNING * INTO v_protest;

  INSERT INTO public.protest_audit_log (protest_id, action, performed_by, old_value, new_value, notes)
  VALUES (
    v_protest.id,
    CASE WHEN p_new_status='decidido' THEN 'decided' ELSE 'status_changed' END,
    v_user, v_old, to_jsonb(v_protest), p_decision_reason
  );

  RETURN v_protest;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_decide_protest(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_decide_protest(uuid,text,text,text) TO authenticated;