
-- Create schema
CREATE SCHEMA IF NOT EXISTS alojamento;

-- Tables

CREATE TABLE alojamento.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE alojamento.facilities ENABLE ROW LEVEL SECURITY;

CREATE TABLE alojamento.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES alojamento.facilities(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender_policy text NOT NULL DEFAULT 'misto' CHECK (gender_policy IN ('misto','masculino','feminino')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(facility_id, name)
);
ALTER TABLE alojamento.blocks ENABLE ROW LEVEL SECURITY;

CREATE TABLE alojamento.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES alojamento.blocks(id) ON DELETE CASCADE,
  code text NOT NULL,
  floor text,
  capacity int NOT NULL CHECK (capacity > 0 AND capacity <= 50),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(block_id, code)
);
ALTER TABLE alojamento.rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE alojamento.beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES alojamento.rooms(id) ON DELETE CASCADE,
  bed_code text NOT NULL,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','bloqueado','manutencao')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, bed_code)
);
ALTER TABLE alojamento.beds ENABLE ROW LEVEL SECURITY;

CREATE TABLE alojamento.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.participants(id),
  bed_id uuid NOT NULL REFERENCES alojamento.beds(id) ON DELETE RESTRICT,
  delegation_id uuid REFERENCES public.delegations(id),
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_assignments_person_active ON alojamento.assignments (person_id) WHERE active = true;
CREATE UNIQUE INDEX idx_assignments_bed_active ON alojamento.assignments (bed_id) WHERE active = true;
ALTER TABLE alojamento.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE alojamento.stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.participants(id),
  facility_id uuid NOT NULL REFERENCES alojamento.facilities(id),
  assignment_id uuid REFERENCES alojamento.assignments(id),
  checkin_at timestamptz NOT NULL,
  checkout_at timestamptz,
  checkin_by uuid REFERENCES auth.users(id),
  checkout_by uuid REFERENCES auth.users(id),
  checkin_device_id text,
  checkout_device_id text,
  status text NOT NULL DEFAULT 'hospedado' CHECK (status IN ('hospedado','finalizado')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stays_facility_checkin ON alojamento.stays (facility_id, checkin_at DESC);
CREATE INDEX idx_stays_person_checkin ON alojamento.stays (person_id, checkin_at DESC);
ALTER TABLE alojamento.stays ENABLE ROW LEVEL SECURITY;

CREATE TABLE alojamento.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  device_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('validate','checkin','checkout','assign')),
  qr_type text NOT NULL CHECK (qr_type IN ('person','bed','room','unknown')),
  qr_payload text NOT NULL,
  person_id uuid,
  bed_id uuid,
  room_id uuid,
  facility_id uuid,
  success boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_scan_events_time ON alojamento.scan_events (scanned_at DESC);
CREATE INDEX idx_scan_events_user ON alojamento.scan_events (user_id, scanned_at DESC);
ALTER TABLE alojamento.scan_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE alojamento.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES alojamento.facilities(id),
  person_id uuid REFERENCES public.participants(id),
  severity text NOT NULL DEFAULT 'baixa' CHECK (severity IN ('baixa','media','alta')),
  category text NOT NULL DEFAULT 'geral' CHECK (category IN ('geral','disciplina','saude','patrimonio','seguranca')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_atendimento','resolvida')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_incidents_facility ON alojamento.incidents (facility_id, created_at DESC);
ALTER TABLE alojamento.incidents ENABLE ROW LEVEL SECURITY;

CREATE TABLE alojamento.qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_type text NOT NULL CHECK (qr_type IN ('person','bed','room')),
  entity_id uuid NOT NULL,
  token text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(qr_type, entity_id),
  UNIQUE(token)
);
ALTER TABLE alojamento.qr_tokens ENABLE ROW LEVEL SECURITY;

-- Triggers updated_at
CREATE OR REPLACE FUNCTION alojamento.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = alojamento;

CREATE TRIGGER trg_facilities_updated_at BEFORE UPDATE ON alojamento.facilities FOR EACH ROW EXECUTE FUNCTION alojamento.set_updated_at();
CREATE TRIGGER trg_blocks_updated_at BEFORE UPDATE ON alojamento.blocks FOR EACH ROW EXECUTE FUNCTION alojamento.set_updated_at();
CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON alojamento.rooms FOR EACH ROW EXECUTE FUNCTION alojamento.set_updated_at();
CREATE TRIGGER trg_beds_updated_at BEFORE UPDATE ON alojamento.beds FOR EACH ROW EXECUTE FUNCTION alojamento.set_updated_at();
CREATE TRIGGER trg_assignments_updated_at BEFORE UPDATE ON alojamento.assignments FOR EACH ROW EXECUTE FUNCTION alojamento.set_updated_at();
CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON alojamento.incidents FOR EACH ROW EXECUTE FUNCTION alojamento.set_updated_at();

-- RLS Policies

-- Facilities
CREATE POLICY "Admin full access facilities" ON alojamento.facilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access facilities" ON alojamento.facilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read active facilities" ON alojamento.facilities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND active = true);

-- Blocks
CREATE POLICY "Admin full access blocks" ON alojamento.blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access blocks" ON alojamento.blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read active blocks" ON alojamento.blocks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND active = true);

-- Rooms
CREATE POLICY "Admin full access rooms" ON alojamento.rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access rooms" ON alojamento.rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read active rooms" ON alojamento.rooms FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND active = true);

-- Beds
CREATE POLICY "Admin full access beds" ON alojamento.beds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access beds" ON alojamento.beds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read active beds" ON alojamento.beds FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND active = true);

-- Assignments
CREATE POLICY "Admin full access assignments" ON alojamento.assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access assignments" ON alojamento.assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read assignments" ON alojamento.assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role));
CREATE POLICY "Alojamento can insert assignments" ON alojamento.assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));
CREATE POLICY "Alojamento can update assignments" ON alojamento.assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));

-- Stays
CREATE POLICY "Admin full access stays" ON alojamento.stays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access stays" ON alojamento.stays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read stays" ON alojamento.stays FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role));
CREATE POLICY "Alojamento can insert stays" ON alojamento.stays FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));
CREATE POLICY "Alojamento can update stays" ON alojamento.stays FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));

-- Scan Events
CREATE POLICY "Admin full access scan_events" ON alojamento.scan_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access scan_events" ON alojamento.scan_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read own scan_events" ON alojamento.scan_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND user_id = auth.uid());
CREATE POLICY "Alojamento can insert scan_events" ON alojamento.scan_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND user_id = auth.uid());

-- Incidents
CREATE POLICY "Admin full access incidents" ON alojamento.incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access incidents" ON alojamento.incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read incidents" ON alojamento.incidents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role));
CREATE POLICY "Alojamento can insert incidents" ON alojamento.incidents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND created_by = auth.uid());
CREATE POLICY "Alojamento can update incidents" ON alojamento.incidents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'alojamento'::public.app_role));

-- QR Tokens
CREATE POLICY "Admin full access qr_tokens" ON alojamento.qr_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Secretaria full access qr_tokens" ON alojamento.qr_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::public.app_role));
CREATE POLICY "Alojamento can read active qr_tokens" ON alojamento.qr_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'alojamento'::public.app_role) AND active = true);

-- RPCs

CREATE OR REPLACE FUNCTION alojamento.resolve_qr(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = alojamento, public
AS $$
DECLARE
  v_qr alojamento.qr_tokens;
  v_result jsonb;
BEGIN
  SELECT * INTO v_qr FROM alojamento.qr_tokens
    WHERE token = p_token AND active = true
      AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TOKEN');
  END IF;

  IF v_qr.qr_type = 'person' THEN
    SELECT jsonb_build_object(
      'ok', true, 'qr_type', 'person', 'entity_id', p.id,
      'full_name', pe.full_name, 'gender', pe.gender, 'birth_date', pe.birth_date,
      'delegation_id', p.delegation_id, 'participant_type', p.participant_type
    ) INTO v_result
    FROM public.participants p JOIN public.people pe ON pe.id = p.person_id
    WHERE p.id = v_qr.entity_id;
  ELSIF v_qr.qr_type = 'bed' THEN
    SELECT jsonb_build_object(
      'ok', true, 'qr_type', 'bed', 'entity_id', b.id,
      'bed_code', b.bed_code, 'room_code', r.code, 'block_name', bl.name,
      'facility_id', f.id, 'facility_name', f.name, 'status', b.status
    ) INTO v_result
    FROM alojamento.beds b
    JOIN alojamento.rooms r ON r.id = b.room_id
    JOIN alojamento.blocks bl ON bl.id = r.block_id
    JOIN alojamento.facilities f ON f.id = bl.facility_id
    WHERE b.id = v_qr.entity_id;
  ELSIF v_qr.qr_type = 'room' THEN
    SELECT jsonb_build_object(
      'ok', true, 'qr_type', 'room', 'entity_id', r.id,
      'room_code', r.code, 'block_name', bl.name,
      'facility_id', f.id, 'facility_name', f.name, 'capacity', r.capacity
    ) INTO v_result
    FROM alojamento.rooms r
    JOIN alojamento.blocks bl ON bl.id = r.block_id
    JOIN alojamento.facilities f ON f.id = bl.facility_id
    WHERE r.id = v_qr.entity_id;
  END IF;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ENTITY_NOT_FOUND');
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION alojamento.pwa_checkin(
  p_device_id text, p_token text, p_facility_id uuid, p_mode text DEFAULT 'person_qr'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = alojamento, public
AS $$
DECLARE
  v_qr_result jsonb; v_person_id uuid; v_birth_date date; v_age int;
  v_existing_stay alojamento.stays; v_new_stay_id uuid;
BEGIN
  IF p_mode = 'person_qr' THEN
    v_qr_result := alojamento.resolve_qr(p_token);
    IF NOT (v_qr_result->>'ok')::boolean THEN
      INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, facility_id, success, error_code)
        VALUES (p_device_id, auth.uid(), 'checkin', 'unknown', p_token, p_facility_id, false, v_qr_result->>'error');
      RETURN v_qr_result;
    END IF;
    IF v_qr_result->>'qr_type' != 'person' THEN
      INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, facility_id, success, error_code)
        VALUES (p_device_id, auth.uid(), 'checkin', v_qr_result->>'qr_type', p_token, p_facility_id, false, 'NOT_A_PERSON');
      RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_PERSON');
    END IF;
    v_person_id := (v_qr_result->>'entity_id')::uuid;
  ELSE
    v_person_id := p_token::uuid;
  END IF;

  SELECT pe.birth_date INTO v_birth_date
    FROM public.participants p JOIN public.people pe ON pe.id = p.person_id WHERE p.id = v_person_id;
  IF v_birth_date IS NOT NULL THEN
    v_age := date_part('year', age(now(), v_birth_date));
    IF v_age < 12 THEN
      INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, person_id, facility_id, success, error_code, error_message)
        VALUES (p_device_id, auth.uid(), 'checkin', 'person', p_token, v_person_id, p_facility_id, false, 'UNDER_12', 'Pessoa com idade inferior a 12 anos');
      RETURN jsonb_build_object('ok', false, 'error', 'UNDER_12', 'message', 'Pessoa com idade inferior a 12 anos');
    END IF;
  END IF;

  SELECT * INTO v_existing_stay FROM alojamento.stays
    WHERE person_id = v_person_id AND facility_id = p_facility_id AND status = 'hospedado' LIMIT 1;
  IF FOUND THEN
    INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, person_id, facility_id, success, error_code)
      VALUES (p_device_id, auth.uid(), 'checkin', 'person', p_token, v_person_id, p_facility_id, false, 'ALREADY_CHECKED_IN');
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CHECKED_IN', 'stay_id', v_existing_stay.id, 'checkin_at', v_existing_stay.checkin_at);
  END IF;

  INSERT INTO alojamento.stays (person_id, facility_id, checkin_at, checkin_by, checkin_device_id, status)
    VALUES (v_person_id, p_facility_id, now(), auth.uid(), p_device_id, 'hospedado')
    RETURNING id INTO v_new_stay_id;
  INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, person_id, facility_id, success)
    VALUES (p_device_id, auth.uid(), 'checkin', 'person', p_token, v_person_id, p_facility_id, true);
  RETURN jsonb_build_object('ok', true, 'stay_id', v_new_stay_id, 'person_id', v_person_id);
END;
$$;

CREATE OR REPLACE FUNCTION alojamento.pwa_checkout(
  p_device_id text, p_token text, p_facility_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = alojamento, public
AS $$
DECLARE
  v_qr_result jsonb; v_person_id uuid; v_stay alojamento.stays;
BEGIN
  v_qr_result := alojamento.resolve_qr(p_token);
  IF NOT (v_qr_result->>'ok')::boolean THEN
    INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, facility_id, success, error_code)
      VALUES (p_device_id, auth.uid(), 'checkout', 'unknown', p_token, p_facility_id, false, v_qr_result->>'error');
    RETURN v_qr_result;
  END IF;
  IF v_qr_result->>'qr_type' != 'person' THEN
    INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, facility_id, success, error_code)
      VALUES (p_device_id, auth.uid(), 'checkout', v_qr_result->>'qr_type', p_token, p_facility_id, false, 'NOT_A_PERSON');
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_A_PERSON');
  END IF;
  v_person_id := (v_qr_result->>'entity_id')::uuid;

  SELECT * INTO v_stay FROM alojamento.stays
    WHERE person_id = v_person_id AND facility_id = p_facility_id AND status = 'hospedado' LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, person_id, facility_id, success, error_code)
      VALUES (p_device_id, auth.uid(), 'checkout', 'person', p_token, v_person_id, p_facility_id, false, 'NOT_CHECKED_IN');
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_CHECKED_IN');
  END IF;

  UPDATE alojamento.stays SET checkout_at = now(), checkout_by = auth.uid(), checkout_device_id = p_device_id, status = 'finalizado' WHERE id = v_stay.id;
  INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, person_id, facility_id, success)
    VALUES (p_device_id, auth.uid(), 'checkout', 'person', p_token, v_person_id, p_facility_id, true);
  RETURN jsonb_build_object('ok', true, 'stay_id', v_stay.id, 'person_id', v_person_id);
END;
$$;

CREATE OR REPLACE FUNCTION alojamento.pwa_assign_bed(
  p_device_id text, p_person_token text, p_bed_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = alojamento, public
AS $$
DECLARE
  v_person_result jsonb; v_bed_result jsonb;
  v_person_id uuid; v_bed_id uuid; v_facility_id uuid; v_new_id uuid;
BEGIN
  v_person_result := alojamento.resolve_qr(p_person_token);
  IF NOT (v_person_result->>'ok')::boolean OR v_person_result->>'qr_type' != 'person' THEN
    INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, success, error_code)
      VALUES (p_device_id, auth.uid(), 'assign', 'unknown', p_person_token, false, 'INVALID_PERSON_TOKEN');
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERSON_TOKEN');
  END IF;

  v_bed_result := alojamento.resolve_qr(p_bed_token);
  IF NOT (v_bed_result->>'ok')::boolean OR v_bed_result->>'qr_type' != 'bed' THEN
    INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, success, error_code)
      VALUES (p_device_id, auth.uid(), 'assign', 'unknown', p_bed_token, false, 'INVALID_BED_TOKEN');
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_BED_TOKEN');
  END IF;

  v_person_id := (v_person_result->>'entity_id')::uuid;
  v_bed_id := (v_bed_result->>'entity_id')::uuid;
  v_facility_id := (v_bed_result->>'facility_id')::uuid;

  IF (v_bed_result->>'status') != 'disponivel' THEN
    INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, person_id, bed_id, facility_id, success, error_code)
      VALUES (p_device_id, auth.uid(), 'assign', 'bed', p_bed_token, v_person_id, v_bed_id, v_facility_id, false, 'BED_UNAVAILABLE');
    RETURN jsonb_build_object('ok', false, 'error', 'BED_UNAVAILABLE');
  END IF;

  UPDATE alojamento.assignments SET active = false WHERE person_id = v_person_id AND active = true;
  INSERT INTO alojamento.assignments (person_id, bed_id, delegation_id, assigned_by, active)
    VALUES (v_person_id, v_bed_id, NULL, auth.uid(), true) RETURNING id INTO v_new_id;
  INSERT INTO alojamento.scan_events (device_id, user_id, action, qr_type, qr_payload, person_id, bed_id, facility_id, success)
    VALUES (p_device_id, auth.uid(), 'assign', 'bed', p_bed_token, v_person_id, v_bed_id, v_facility_id, true);
  RETURN jsonb_build_object('ok', true, 'assignment_id', v_new_id, 'person_id', v_person_id, 'bed_id', v_bed_id);
END;
$$;

CREATE OR REPLACE FUNCTION alojamento.pwa_search_person(
  p_query text, p_facility_id uuid, p_limit int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = alojamento, public
AS $$
DECLARE v_results jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_results
  FROM (
    SELECT p.id AS participant_id, pe.full_name, pe.birth_date, pe.gender, pe.cpf, p.participant_type, p.delegation_id,
      EXISTS(SELECT 1 FROM alojamento.stays s WHERE s.person_id = p.id AND s.facility_id = p_facility_id AND s.status = 'hospedado') AS is_checked_in,
      (SELECT b.bed_code FROM alojamento.assignments a JOIN alojamento.beds b ON b.id = a.bed_id WHERE a.person_id = p.id AND a.active = true LIMIT 1) AS bed_code
    FROM public.participants p JOIN public.people pe ON pe.id = p.person_id
    WHERE (pe.full_name ILIKE '%' || p_query || '%' OR pe.cpf ILIKE '%' || p_query || '%') AND p.is_active = true
    ORDER BY pe.full_name LIMIT p_limit
  ) r;
  RETURN jsonb_build_object('ok', true, 'results', v_results);
END;
$$;

CREATE OR REPLACE FUNCTION alojamento.admin_generate_qr(
  p_qr_type text, p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = alojamento, public
AS $$
DECLARE v_token text; v_existing alojamento.qr_tokens;
BEGIN
  SELECT * INTO v_existing FROM alojamento.qr_tokens WHERE qr_type = p_qr_type AND entity_id = p_entity_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'token', v_existing.token, 'payload', 'JER-ALJ:' || v_existing.token, 'id', v_existing.id);
  END IF;
  v_token := encode(gen_random_bytes(9), 'base64');
  v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');
  v_token := left(v_token, 12);
  INSERT INTO alojamento.qr_tokens (qr_type, entity_id, token, created_by)
    VALUES (p_qr_type, p_entity_id, v_token, auth.uid());
  RETURN jsonb_build_object('ok', true, 'token', v_token, 'payload', 'JER-ALJ:' || v_token, 'new', true);
END;
$$;

-- Grant schema access
GRANT USAGE ON SCHEMA alojamento TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA alojamento TO authenticated;
