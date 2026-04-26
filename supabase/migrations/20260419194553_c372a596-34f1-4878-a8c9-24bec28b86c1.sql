-- =============================================================
-- FASE 1+2: Pessoa unificada + Vouchers QR
-- =============================================================

-- 1) PARTICIPANTS: delegation opcional + ampliar tipos + elegibilidade logÃƒÂ­stica
ALTER TABLE public.participants
  ALTER COLUMN delegation_id DROP NOT NULL;

ALTER TABLE public.participants
  DROP CONSTRAINT IF EXISTS participants_participant_type_check;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_participant_type_check
  CHECK (participant_type = ANY (ARRAY[
    'athlete','coach','head_of_delegation','official','staff',
    'motorista','agente_operacao','logistica','cozinheira','guia',
    'secretaria','mesario','arbitro','delegado','fiscal',
    'operador_pesquisa','tecnico_ti','terceiro','colaborador'
  ]));

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS needs_transport boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_meals     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_lodging   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logistics_restrictions text,
  ADD COLUMN IF NOT EXISTS logistics_notes text;

-- Atletas por padrÃƒÂ£o precisam de tudo (legacy data) Ã¢â‚¬â€ sÃƒÂ³ uma vez
UPDATE public.participants
SET needs_transport = true, needs_meals = true, needs_lodging = true
WHERE participant_type = 'athlete' AND created_at < now();

-- 2) CATÃƒÂLOGO DE FUNÃƒâ€¡Ãƒâ€¢ES (editÃƒÂ¡vel pelo admin)
CREATE TABLE IF NOT EXISTS public.event_role_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_role_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_catalog_read_authenticated" ON public.event_role_catalog; CREATE POLICY "role_catalog_read_authenticated"
  ON public.event_role_catalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_catalog_write_admin" ON public.event_role_catalog; CREATE POLICY "role_catalog_write_admin"
  ON public.event_role_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria') OR public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.event_role_catalog (code, name, description, sort_order) VALUES
  ('motorista','Motorista','Condutor de veÃƒÂ­culo oficial',10),
  ('agente_operacao','Agente de OperaÃƒÂ§ÃƒÂ£o','Apoio operacional geral',20),
  ('logistica','LogÃƒÂ­stica','Equipe de logÃƒÂ­stica do evento',30),
  ('cozinheira','Cozinheira(o)','Equipe de cozinha',40),
  ('guia','Guia','Acompanhante de delegaÃƒÂ§ÃƒÂ£o',50),
  ('secretaria','Secretaria','Equipe administrativa',60),
  ('mesario','MesÃƒÂ¡rio','Operador de mesa em partidas',70),
  ('arbitro','ÃƒÂrbitro','ComissÃƒÂ£o de arbitragem',80),
  ('delegado','Delegado','Representante de delegaÃƒÂ§ÃƒÂ£o',90),
  ('fiscal','Fiscal','FiscalizaÃƒÂ§ÃƒÂ£o do evento',100),
  ('operador_pesquisa','Operador de Pesquisa','Equipe de pesquisa de satisfaÃƒÂ§ÃƒÂ£o',110),
  ('tecnico_ti','TÃƒÂ©cnico de TI','Suporte tÃƒÂ©cnico de TI',120),
  ('colaborador','Colaborador','Colaborador da organizaÃƒÂ§ÃƒÂ£o',130),
  ('terceiro','Terceiro','Prestador de serviÃƒÂ§o externo',140)
ON CONFLICT (code) DO NOTHING;

DROP TRIGGER IF EXISTS trg_role_catalog_touch ON public.event_role_catalog; CREATE TRIGGER trg_role_catalog_touch
  BEFORE UPDATE ON public.event_role_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) SERVICE VOUCHERS (multiuso com escopo)
CREATE TABLE IF NOT EXISTS public.service_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  qr_code_value text NOT NULL UNIQUE,
  scope_transport boolean NOT NULL DEFAULT false,
  scope_meals     boolean NOT NULL DEFAULT false,
  scope_lodging   boolean NOT NULL DEFAULT false,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  max_uses integer,        -- NULL = ilimitado dentro da janela
  current_uses integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  notes text,
  issued_by uuid,
  revoked_by uuid,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_vouchers_event ON public.service_vouchers(event_id);
CREATE INDEX IF NOT EXISTS idx_service_vouchers_participant ON public.service_vouchers(participant_id);
CREATE INDEX IF NOT EXISTS idx_service_vouchers_status ON public.service_vouchers(status) WHERE status='active';

ALTER TABLE public.service_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vouchers_read_admin_ops"
  ON public.service_vouchers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'secretaria')
    OR public.has_role(auth.uid(),'coordenacao_tecnica')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'transporte')
    OR public.has_role(auth.uid(),'alimentacao')
    OR public.has_role(auth.uid(),'alojamento')
  );

CREATE POLICY "vouchers_write_admin"
  ON public.service_vouchers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'secretaria') OR public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS trg_service_vouchers_touch ON public.service_vouchers; CREATE TRIGGER trg_service_vouchers_touch
  BEFORE UPDATE ON public.service_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) HISTÃƒâ€œRICO DE USOS DO VOUCHER
CREATE TABLE IF NOT EXISTS public.service_voucher_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.service_vouchers(id) ON DELETE CASCADE,
  service_kind text NOT NULL CHECK (service_kind IN ('transport','meals','lodging')),
  context_id uuid,        -- meal_window_id / trip_id / unit_id, conforme o caso
  used_at timestamptz NOT NULL DEFAULT now(),
  used_by uuid,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_voucher_uses_voucher ON public.service_voucher_uses(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_uses_kind ON public.service_voucher_uses(service_kind);

ALTER TABLE public.service_voucher_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voucher_uses_read"
  ON public.service_voucher_uses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'secretaria')
    OR public.has_role(auth.uid(),'coordenacao_tecnica')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'transporte')
    OR public.has_role(auth.uid(),'alimentacao')
    OR public.has_role(auth.uid(),'alojamento')
  );

-- Inserts sÃƒÂ³ via RPC redeem_voucher (security definer)

-- 5) RPC ATÃƒâ€MICA DE RESGATE
CREATE OR REPLACE FUNCTION public.redeem_voucher(
  p_qr_value text,
  p_service_kind text,
  p_context_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher public.service_vouchers%ROWTYPE;
  v_caller uuid := auth.uid();
  v_allowed boolean;
  v_person_name text;
BEGIN
  IF p_service_kind NOT IN ('transport','meals','lodging') THEN
    RAISE EXCEPTION 'service_kind invÃƒÂ¡lido' USING ERRCODE = '22023';
  END IF;

  -- Valida perfil do chamador conforme o serviÃƒÂ§o
  v_allowed := CASE p_service_kind
    WHEN 'transport' THEN public.has_role(v_caller,'transporte') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria')
    WHEN 'meals'     THEN public.has_role(v_caller,'alimentacao') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria')
    WHEN 'lodging'   THEN public.has_role(v_caller,'alojamento') OR public.has_role(v_caller,'admin') OR public.has_role(v_caller,'secretaria')
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissÃƒÂ£o para validar este serviÃƒÂ§o' USING ERRCODE = '42501';
  END IF;

  -- Lock pessimista do voucher
  SELECT * INTO v_voucher FROM public.service_vouchers
  WHERE qr_code_value = p_qr_value FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_voucher.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive', 'status', v_voucher.status);
  END IF;

  IF v_voucher.valid_until IS NOT NULL AND v_voucher.valid_until < now() THEN
    UPDATE public.service_vouchers SET status='expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF v_voucher.valid_from > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid');
  END IF;

  -- Escopo
  IF (p_service_kind = 'transport' AND NOT v_voucher.scope_transport)
     OR (p_service_kind = 'meals'   AND NOT v_voucher.scope_meals)
     OR (p_service_kind = 'lodging' AND NOT v_voucher.scope_lodging) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'scope_denied');
  END IF;

  -- Limite de usos
  IF v_voucher.max_uses IS NOT NULL AND v_voucher.current_uses >= v_voucher.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'max_uses_reached');
  END IF;

  INSERT INTO public.service_voucher_uses (voucher_id, service_kind, context_id, used_by)
  VALUES (v_voucher.id, p_service_kind, p_context_id, v_caller);

  UPDATE public.service_vouchers
  SET current_uses = current_uses + 1
  WHERE id = v_voucher.id;

  SELECT pe.full_name INTO v_person_name
  FROM public.participants pa
  JOIN public.people pe ON pe.id = pa.person_id
  WHERE pa.id = v_voucher.participant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'participant_id', v_voucher.participant_id,
    'person_name', v_person_name,
    'remaining_uses', CASE WHEN v_voucher.max_uses IS NULL THEN NULL ELSE v_voucher.max_uses - (v_voucher.current_uses + 1) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(text, text, uuid) TO authenticated;

-- 6) AUDITORIA
CREATE OR REPLACE FUNCTION public.audit_people_voucher_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_events (table_name, record_id, action, payload, created_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text)::uuid,
    TG_OP,
    CASE TG_OP
      WHEN 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_people ON public.people;
CREATE TRIGGER trg_audit_people
  AFTER INSERT OR UPDATE OR DELETE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.audit_people_voucher_changes();

DROP TRIGGER IF EXISTS trg_audit_participants ON public.participants;
CREATE TRIGGER trg_audit_participants
  AFTER INSERT OR UPDATE OR DELETE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.audit_people_voucher_changes();

DROP TRIGGER IF EXISTS trg_audit_vouchers ON public.service_vouchers;
CREATE TRIGGER trg_audit_vouchers
  AFTER INSERT OR UPDATE OR DELETE ON public.service_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.audit_people_voucher_changes();

DO $$
BEGIN
  IF to_regclass('public.participant_event_roles') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_event_roles ON public.participant_event_roles';
    EXECUTE 'CREATE TRIGGER trg_audit_event_roles AFTER INSERT OR UPDATE OR DELETE ON public.participant_event_roles FOR EACH ROW EXECUTE FUNCTION public.audit_people_voucher_changes()';
  ELSE
    RAISE NOTICE 'Skipping trg_audit_event_roles: table public.participant_event_roles not found';
  END IF;
END $$;
