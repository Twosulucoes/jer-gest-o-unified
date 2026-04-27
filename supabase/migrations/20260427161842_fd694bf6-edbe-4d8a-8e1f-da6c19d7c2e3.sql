
-- Function to trigger bulletin generation
CREATE OR REPLACE FUNCTION public.fn_trigger_after_match_publish()
RETURNS TRIGGER AS $$
DECLARE
    v_event_id UUID;
    v_stage_id UUID;
    v_match_date DATE;
    v_payload JSONB;
BEGIN
    -- Only trigger if status changed to 'publicado'
    IF (NEW.result_status = 'publicado' AND (OLD.result_status IS NULL OR OLD.result_status <> 'publicado')) THEN
        -- Get event_id, stage_id and match_date
        SELECT event_id, stage_id, match_date 
        INTO v_event_id, v_stage_id, v_match_date
        FROM public.competition_matches
        WHERE id = NEW.match_id;

        IF v_event_id IS NOT NULL AND v_stage_id IS NOT NULL AND v_match_date IS NOT NULL THEN
            v_payload := jsonb_build_object(
                'eventId', v_event_id,
                'stageId', v_stage_id,
                'referenceDate', v_match_date,
                'bulletinType', 'daily',
                'trigger', 'automatic_after_publish'
            );

            -- Use net.http_post to call the edge function
            -- NOTE: This requires pg_net extension which is usually enabled in Supabase
            PERFORM net.http_post(
                url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-bulletin',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
                ),
                body := v_payload
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trg_after_match_publish ON public.competition_match_results;
CREATE TRIGGER trg_after_match_publish
AFTER UPDATE ON public.competition_match_results
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_after_match_publish();
