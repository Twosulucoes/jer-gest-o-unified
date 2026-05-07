-- ============================================================
-- 1. ADIÇÃO DE COLUNA LEGACY EM SCAN
-- ============================================================
ALTER TABLE public.credential_scans ADD COLUMN IF NOT EXISTS legacy_format boolean DEFAULT false;

-- ============================================================
-- 2. TRIGGER DE VALIDAÇÃO DE GÊNERO NO ALOJAMENTO
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_lodging_gender()
RETURNS trigger AS $$
DECLARE
  v_participant_gender text;
  v_unit_restriction text;
BEGIN
  -- Busca o gênero da pessoa associada ao participante
  SELECT p.gender INTO v_participant_gender
  FROM public.participants part
  JOIN public.people p ON part.person_id = p.id
  WHERE part.id = NEW.participant_id;

  -- Busca a restrição de gênero da unidade
  SELECT gender_restriction INTO v_unit_restriction
  FROM public.lodging_units
  WHERE id = NEW.unit_id;

  -- Se o gênero do participante não estiver definido, permitimos mas poderíamos registrar log no futuro
  IF v_participant_gender IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validação
  IF v_unit_restriction = 'male' AND v_participant_gender != 'male' THEN
    RAISE EXCEPTION 'Gênero do participante incompatível com a unidade de alojamento (restrição: masculina)';
  ELSIF v_unit_restriction = 'female' AND v_participant_gender != 'female' THEN
    RAISE EXCEPTION 'Gênero do participante incompatível com a unidade de alojamento (restrição: feminina)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_lodging_gender ON public.lodging_occupancies;
CREATE TRIGGER trg_validate_lodging_gender
  BEFORE INSERT OR UPDATE ON public.lodging_occupancies
  FOR EACH ROW EXECUTE FUNCTION public.validate_lodging_gender();

-- ============================================================
-- 3. ELEGIBILIDADE DE JANELAS DE REFEIÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_window_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_window_id uuid NOT NULL REFERENCES public.meal_windows(id) ON DELETE CASCADE,
  eligibility_type text NOT NULL CHECK (eligibility_type IN ('all', 'delegation', 'institution', 'participant_type')),
  reference_id uuid, -- Para delegation ou institution
  participant_type_value text, -- Para athlete, coach, staff, etc.
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para meal_window_eligibility
ALTER TABLE public.meal_window_eligibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Alimentacao can manage meal_window_eligibility"
  ON public.meal_window_eligibility FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'alimentacao'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'alimentacao'));

CREATE POLICY "Others can read meal_window_eligibility"
  ON public.meal_window_eligibility FOR SELECT TO authenticated
  USING (true);

-- Índices
CREATE INDEX idx_meal_window_eligibility_window ON public.meal_window_eligibility(meal_window_id);
CREATE INDEX idx_meal_window_eligibility_ref ON public.meal_window_eligibility(reference_id);

-- Trigger de Auditoria (updated_at)
CREATE TRIGGER update_meal_window_eligibility_updated_at
  BEFORE UPDATE ON public.meal_window_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lógica de validação de elegibilidade no consumo
CREATE OR REPLACE FUNCTION public.validate_meal_consumption_eligibility()
RETURNS trigger AS $$
DECLARE
  v_has_rules boolean;
  v_is_eligible boolean;
  v_participant_delegation_id uuid;
  v_participant_institution_id uuid;
  v_participant_type text;
  v_restrictions_msg text;
BEGIN
  -- Verifica se existem regras para esta janela
  SELECT EXISTS (
    SELECT 1 FROM public.meal_window_eligibility WHERE meal_window_id = NEW.meal_window_id
  ) INTO v_has_rules;

  -- Se não há regras, todos podem consumir
  IF NOT v_has_rules THEN
    RETURN NEW;
  END IF;

  -- Busca dados do participante
  SELECT 
    p.delegation_id, 
    d.institution_id, 
    p.participant_type 
  INTO 
    v_participant_delegation_id, 
    v_participant_institution_id, 
    v_participant_type
  FROM public.participants p
  LEFT JOIN public.delegations d ON p.delegation_id = d.id
  WHERE p.id = NEW.participant_id;

  -- Verifica se enquadra em alguma regra
  SELECT EXISTS (
    SELECT 1 FROM public.meal_window_eligibility
    WHERE meal_window_id = NEW.meal_window_id
    AND (
      eligibility_type = 'all'
      OR (eligibility_type = 'delegation' AND reference_id = v_participant_delegation_id)
      OR (eligibility_type = 'institution' AND reference_id = v_participant_institution_id)
      OR (eligibility_type = 'participant_type' AND participant_type_value = v_participant_type)
    )
  ) INTO v_is_eligible;

  IF NOT v_is_eligible THEN
    -- Constrói lista de restrições para erro
    SELECT string_agg(
      CASE 
        WHEN eligibility_type = 'delegation' THEN 'Delegação específica'
        WHEN eligibility_type = 'institution' THEN 'Instituição específica'
        WHEN eligibility_type = 'participant_type' THEN 'Perfil: ' || participant_type_value
        ELSE eligibility_type
      END, ', '
    ) INTO v_restrictions_msg
    FROM public.meal_window_eligibility
    WHERE meal_window_id = NEW.meal_window_id;

    RAISE EXCEPTION 'Participante não autorizado a consumir nesta janela. Restrições aplicáveis: %', v_restrictions_msg;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_meal_consumption_eligibility ON public.meal_consumptions;
CREATE TRIGGER trg_validate_meal_consumption_eligibility
  BEFORE INSERT ON public.meal_consumptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_meal_consumption_eligibility();

-- ============================================================
-- 4. TABELA GENÉRICA DE EVIDÊNCIAS OSC
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operational_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('credenciamento', 'alimentacao', 'alojamento', 'transporte', 'competicao', 'geral')),
  evidence_type text NOT NULL CHECK (evidence_type IN ('photo', 'document', 'list', 'report', 'other')),
  reference_table text,
  reference_id uuid,
  file_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size_bytes bigint,
  description text,
  period_start date,
  period_end date,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text
);

-- RLS para operational_evidence
ALTER TABLE public.operational_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Secretaria full access operational_evidence"
  ON public.operational_evidence FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria'));

CREATE POLICY "Users can insert evidence for their modules"
  ON public.operational_evidence FOR INSERT TO authenticated
  WITH CHECK (
    (module = 'alimentacao' AND has_role(auth.uid(), 'alimentacao')) OR
    (module = 'alojamento' AND has_role(auth.uid(), 'alojamento')) OR
    (module = 'transporte' AND has_role(auth.uid(), 'transporte')) OR
    (module = 'credenciamento' AND has_role(auth.uid(), 'secretaria')) OR
    (module = 'competicao' AND has_role(auth.uid(), 'coordenacao_tecnica'))
  );

CREATE POLICY "Users can read evidence of their modules"
  ON public.operational_evidence FOR SELECT TO authenticated
  USING (
    (module = 'alimentacao' AND has_role(auth.uid(), 'alimentacao')) OR
    (module = 'alojamento' AND has_role(auth.uid(), 'alojamento')) OR
    (module = 'transporte' AND has_role(auth.uid(), 'transporte')) OR
    (module = 'credenciamento' AND has_role(auth.uid(), 'secretaria')) OR
    (module = 'competicao' AND has_role(auth.uid(), 'coordenacao_tecnica'))
  );

-- Índices
CREATE INDEX idx_operational_evidence_event_module ON public.operational_evidence(event_id, module);
CREATE INDEX idx_operational_evidence_uploader ON public.operational_evidence(uploaded_by);
CREATE INDEX idx_operational_evidence_status ON public.operational_evidence(status);

-- ============================================================
-- 5. BUCKET DEDICADO PARA EVIDÊNCIAS OSC
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('operational-evidence', 'operational-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para operational-evidence
CREATE POLICY "Admin and Secretaria full access storage_evid"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'operational-evidence' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')))
  WITH CHECK (bucket_id = 'operational-evidence' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaria')));

CREATE POLICY "Module users can upload evidence_evid"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'operational-evidence' AND (
      (has_role(auth.uid(), 'alimentacao') AND (storage.foldername(name))[1] = (SELECT id::text FROM events WHERE is_active = true LIMIT 1)) OR
      has_role(auth.uid(), 'admin')
    )
  );
-- Simplificando as políticas de storage para evitar erros de foldername
