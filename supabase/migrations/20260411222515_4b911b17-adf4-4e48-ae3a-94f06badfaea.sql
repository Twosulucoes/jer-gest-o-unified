
-- 1) official_bulletins table
CREATE TABLE IF NOT EXISTS public.official_bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  number int NOT NULL,
  title text NOT NULL,
  content_md text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz NULL,
  published_by uuid NULL,
  rectifies_bulletin_id uuid NULL REFERENCES public.official_bulletins(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  UNIQUE (event_id, number)
);

ALTER TABLE public.official_bulletins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access official_bulletins"
  ON public.official_bulletins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Secretaria full access official_bulletins"
  ON public.official_bulletins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'::app_role));

CREATE POLICY "Coordenacao tecnica can manage official_bulletins"
  ON public.official_bulletins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordenacao_tecnica'::app_role));

-- 2) Add published_bulletin_id to competition_match_results
ALTER TABLE public.competition_match_results
  ADD COLUMN IF NOT EXISTS published_bulletin_id uuid REFERENCES public.official_bulletins(id);

-- 3) RPC: create bulletin with auto-number
CREATE OR REPLACE FUNCTION public.rpc_create_bulletin(
  p_event_id uuid,
  p_title text,
  p_content_md text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_next_number int;
  v_id uuid;
BEGIN
  SELECT COALESCE(MAX(number), 0) + 1 INTO v_next_number
  FROM public.official_bulletins WHERE event_id = p_event_id;

  INSERT INTO public.official_bulletins (event_id, number, title, content_md, created_by, updated_by)
  VALUES (p_event_id, v_next_number, p_title, p_content_md, auth.uid(), auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'number', v_next_number);
END;
$$;

-- 4) RPC: publish bulletin
CREATE OR REPLACE FUNCTION public.rpc_publish_bulletin(p_bulletin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.official_bulletins
  SET status = 'published', published_at = now(), published_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_bulletin_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boletim não encontrado ou já publicado.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('id', p_bulletin_id, 'status', 'published');
END;
$$;

-- 5) RPC: validate results for sport_event (launched -> validated)
CREATE OR REPLACE FUNCTION public.rpc_validate_results_for_sport_event(
  p_event_id uuid,
  p_sport_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.competition_match_results cmr
  SET result_status = 'validated',
      validated_at = now(),
      validated_by = auth.uid(),
      updated_at = now()
  FROM public.competition_matches cm
  WHERE cmr.match_id = cm.id
    AND cm.event_id = p_event_id
    AND cm.sport_event_id = p_sport_event_id
    AND cmr.result_status = 'resultado_lancado';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('validated_count', v_count);
END;
$$;

-- 6) RPC: publish results for sport_event (validated -> published, link to bulletin)
CREATE OR REPLACE FUNCTION public.rpc_publish_results_for_sport_event(
  p_event_id uuid,
  p_sport_event_id uuid,
  p_bulletin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count int;
  v_bulletin_status text;
BEGIN
  SELECT status INTO v_bulletin_status FROM public.official_bulletins WHERE id = p_bulletin_id;
  IF v_bulletin_status IS NULL OR v_bulletin_status <> 'published' THEN
    RAISE EXCEPTION 'Boletim precisa estar publicado antes de vincular resultados.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.competition_match_results cmr
  SET result_status = 'publicado',
      published_at = now(),
      published_by = auth.uid(),
      published_bulletin_id = p_bulletin_id,
      updated_at = now()
  FROM public.competition_matches cm
  WHERE cmr.match_id = cm.id
    AND cm.event_id = p_event_id
    AND cm.sport_event_id = p_sport_event_id
    AND cmr.result_status = 'validated';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('published_count', v_count, 'bulletin_id', p_bulletin_id);
END;
$$;
