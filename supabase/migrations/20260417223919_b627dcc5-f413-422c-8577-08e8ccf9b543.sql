-- ============================================================
-- FASE 3: Fusão institutions → delegations (não-destrutiva)
-- ============================================================
-- 1. Adiciona campos school_* em delegations
ALTER TABLE public.delegations
  ADD COLUMN IF NOT EXISTS school_name text,
  ADD COLUMN IF NOT EXISTS school_official_name text,
  ADD COLUMN IF NOT EXISTS school_slug text,
  ADD COLUMN IF NOT EXISTS school_network_type text,
  ADD COLUMN IF NOT EXISTS school_city text,
  ADD COLUMN IF NOT EXISTS school_state text,
  ADD COLUMN IF NOT EXISTS school_district text,
  ADD COLUMN IF NOT EXISTS school_contact_name text,
  ADD COLUMN IF NOT EXISTS school_contact_phone text,
  ADD COLUMN IF NOT EXISTS school_contact_email text,
  ADD COLUMN IF NOT EXISTS school_is_active boolean DEFAULT true;

-- 2. Backfill dos dados de institutions
UPDATE public.delegations d
SET
  school_name = i.name,
  school_official_name = i.official_name,
  school_slug = i.slug,
  school_network_type = i.network_type,
  school_city = i.city,
  school_state = i.state,
  school_district = i.district,
  school_contact_name = i.contact_name,
  school_contact_phone = i.contact_phone,
  school_contact_email = i.contact_email,
  school_is_active = i.is_active
FROM public.institutions i
WHERE d.institution_id = i.id
  AND d.school_name IS NULL;

-- 3. Garante NOT NULL nos campos essenciais
UPDATE public.delegations SET school_name = COALESCE(school_name, 'Sem nome') WHERE school_name IS NULL;
UPDATE public.delegations SET school_slug = COALESCE(school_slug, id::text) WHERE school_slug IS NULL;
UPDATE public.delegations SET school_network_type = COALESCE(school_network_type, 'municipal') WHERE school_network_type IS NULL;

ALTER TABLE public.delegations
  ALTER COLUMN school_name SET NOT NULL,
  ALTER COLUMN school_slug SET NOT NULL,
  ALTER COLUMN school_network_type SET NOT NULL,
  ALTER COLUMN school_is_active SET NOT NULL;

-- 4. Índice único em school_slug por evento
CREATE UNIQUE INDEX IF NOT EXISTS delegations_school_slug_event_key
  ON public.delegations(event_id, school_slug);

-- 5. Trigger: ao inserir delegação SEM institution_id, cria institution sintética
--    (mantém compatibilidade com NOT NULL existente em institution_id)
CREATE OR REPLACE FUNCTION public.delegations_autocreate_institution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst_id uuid;
BEGIN
  IF NEW.institution_id IS NULL THEN
    INSERT INTO public.institutions (name, official_name, slug, network_type, city, state, district, contact_name, contact_phone, contact_email, is_active)
    VALUES (
      NEW.school_name,
      NEW.school_official_name,
      COALESCE(NEW.school_slug, NEW.id::text),
      COALESCE(NEW.school_network_type, 'municipal'),
      NEW.school_city, NEW.school_state, NEW.school_district,
      NEW.school_contact_name, NEW.school_contact_phone, NEW.school_contact_email,
      COALESCE(NEW.school_is_active, true)
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_inst_id;
    NEW.institution_id := v_inst_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delegations_autocreate_institution ON public.delegations;
CREATE TRIGGER trg_delegations_autocreate_institution
  BEFORE INSERT ON public.delegations
  FOR EACH ROW EXECUTE FUNCTION public.delegations_autocreate_institution();

-- 6. Trigger: ao atualizar school_*, propaga para institutions (mantém em sync)
CREATE OR REPLACE FUNCTION public.delegations_sync_to_institution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.institution_id IS NOT NULL AND (
    NEW.school_name IS DISTINCT FROM OLD.school_name OR
    NEW.school_official_name IS DISTINCT FROM OLD.school_official_name OR
    NEW.school_slug IS DISTINCT FROM OLD.school_slug OR
    NEW.school_network_type IS DISTINCT FROM OLD.school_network_type OR
    NEW.school_city IS DISTINCT FROM OLD.school_city OR
    NEW.school_state IS DISTINCT FROM OLD.school_state OR
    NEW.school_district IS DISTINCT FROM OLD.school_district OR
    NEW.school_contact_name IS DISTINCT FROM OLD.school_contact_name OR
    NEW.school_contact_phone IS DISTINCT FROM OLD.school_contact_phone OR
    NEW.school_contact_email IS DISTINCT FROM OLD.school_contact_email OR
    NEW.school_is_active IS DISTINCT FROM OLD.school_is_active
  ) THEN
    UPDATE public.institutions SET
      name = NEW.school_name,
      official_name = NEW.school_official_name,
      slug = NEW.school_slug,
      network_type = NEW.school_network_type,
      city = NEW.school_city,
      state = NEW.school_state,
      district = NEW.school_district,
      contact_name = NEW.school_contact_name,
      contact_phone = NEW.school_contact_phone,
      contact_email = NEW.school_contact_email,
      is_active = NEW.school_is_active,
      updated_at = now()
    WHERE id = NEW.institution_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delegations_sync_to_institution ON public.delegations;
CREATE TRIGGER trg_delegations_sync_to_institution
  AFTER UPDATE ON public.delegations
  FOR EACH ROW EXECUTE FUNCTION public.delegations_sync_to_institution();

-- 7. Trigger reverso: ao atualizar institutions, propaga para delegations
CREATE OR REPLACE FUNCTION public.institutions_sync_to_delegations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.delegations SET
    school_name = NEW.name,
    school_official_name = NEW.official_name,
    school_slug = NEW.slug,
    school_network_type = NEW.network_type,
    school_city = NEW.city,
    school_state = NEW.state,
    school_district = NEW.district,
    school_contact_name = NEW.contact_name,
    school_contact_phone = NEW.contact_phone,
    school_contact_email = NEW.contact_email,
    school_is_active = NEW.is_active
  WHERE institution_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_institutions_sync_to_delegations ON public.institutions;
CREATE TRIGGER trg_institutions_sync_to_delegations
  AFTER UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.institutions_sync_to_delegations();
