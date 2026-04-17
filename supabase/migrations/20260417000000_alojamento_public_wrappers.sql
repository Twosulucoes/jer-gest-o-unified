-- Public wrappers for alojamento schema RPCs
-- Needed because supabase-js rpc() only calls functions in the public schema.

CREATE OR REPLACE FUNCTION public.resolve_qr(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN alojamento.resolve_qr(p_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.pwa_checkin(
  p_device_id text,
  p_token text,
  p_facility_id uuid,
  p_mode text DEFAULT 'person_qr'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN alojamento.pwa_checkin(p_device_id, p_token, p_facility_id, p_mode);
END;
$$;

CREATE OR REPLACE FUNCTION public.pwa_checkout(
  p_device_id text,
  p_token text,
  p_facility_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN alojamento.pwa_checkout(p_device_id, p_token, p_facility_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.pwa_assign_bed(
  p_device_id text,
  p_person_token text,
  p_bed_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN alojamento.pwa_assign_bed(p_device_id, p_person_token, p_bed_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.pwa_search_person(
  p_query text,
  p_facility_id uuid,
  p_limit int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN alojamento.pwa_search_person(p_query, p_facility_id, p_limit);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_generate_qr(
  p_qr_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN alojamento.admin_generate_qr(p_qr_type, p_entity_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_qr(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pwa_checkin(text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pwa_checkout(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pwa_assign_bed(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pwa_search_person(text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_generate_qr(text, uuid) TO authenticated;
