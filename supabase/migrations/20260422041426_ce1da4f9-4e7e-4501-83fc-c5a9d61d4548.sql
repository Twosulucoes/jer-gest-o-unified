-- Update rpc_publish_bulletin to include audit logging
CREATE OR REPLACE FUNCTION public.rpc_publish_bulletin(p_bulletin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id uuid;
    v_title text;
BEGIN
    -- Get bulletin info before update for logging
    SELECT event_id, title INTO v_event_id, v_title
    FROM public.official_bulletins
    WHERE id = p_bulletin_id;

    UPDATE public.official_bulletins
    SET 
        status = 'publicado',
        published_at = now(),
        published_by = auth.uid(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_bulletin_id AND status = 'rascunho';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Boletim não encontrado ou já publicado.' USING ERRCODE = 'P0001';
    END IF;

    -- Add audit log
    INSERT INTO public.audit_events (
        table_name,
        record_id,
        action,
        payload,
        created_by
    ) VALUES (
        'official_bulletins',
        p_bulletin_id::text,
        'publish_bulletin',
        jsonb_build_object(
            'bulletin_id', p_bulletin_id,
            'event_id', v_event_id,
            'title', v_title,
            'published_at', now()
        ),
        auth.uid()
    );

    RETURN jsonb_build_object('id', p_bulletin_id, 'status', 'publicado');
END;
$$;

-- Update rpc_publish_results_for_sport_event to include audit logging
CREATE OR REPLACE FUNCTION public.rpc_publish_results_for_sport_event(
    p_event_id uuid,
    p_sport_event_id uuid,
    p_bulletin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count int;
    v_bulletin_status public.bulletin_status;
BEGIN
    SELECT status INTO v_bulletin_status
    FROM public.official_bulletins
    WHERE id = p_bulletin_id;

    IF v_bulletin_status IS NULL OR v_bulletin_status <> 'publicado' THEN
        RAISE EXCEPTION 'Boletim precisa estar publicado antes de vincular resultados.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.competition_match_results cmr
    SET 
        result_status = 'publicado',
        published_at = now(),
        published_by = auth.uid(),
        published_bulletin_id = p_bulletin_id,
        updated_at = now()
    FROM public.competition_matches cm
    WHERE cmr.match_id = cm.id 
      AND cm.event_id = p_event_id 
      AND cm.sport_event_id = p_sport_event_id 
      AND cmr.result_status = 'resultado_validado';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Add audit log
    INSERT INTO public.audit_events (
        table_name,
        record_id,
        action,
        payload,
        created_by
    ) VALUES (
        'competition_match_results',
        p_event_id::text, -- Using event_id as the primary reference for this batch operation
        'publish_results',
        jsonb_build_object(
            'event_id', p_event_id,
            'sport_event_id', p_sport_event_id,
            'bulletin_id', p_bulletin_id,
            'published_count', v_count,
            'published_at', now()
        ),
        auth.uid()
    );

    RETURN jsonb_build_object('published_count', v_count);
END;
$$;