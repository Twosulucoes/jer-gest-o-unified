
-- Add auto_transition column to competition_phases
ALTER TABLE public.competition_phases
ADD COLUMN IF NOT EXISTS auto_transition boolean NOT NULL DEFAULT true;

-- RPC: check_phase_transitions
CREATE OR REPLACE FUNCTION public.check_phase_transitions(p_sport_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase RECORD;
  v_next RECORD;
  v_all_finished boolean;
  v_all_published boolean;
  v_match_count integer;
  v_transitions jsonb := '[]'::jsonb;
BEGIN
  -- Loop through in_progress phases for this sport_event
  FOR v_phase IN
    SELECT id, name, sort_order, event_id
    FROM competition_phases
    WHERE sport_event_id = p_sport_event_id
      AND status = 'in_progress'
      AND auto_transition = true
    ORDER BY sort_order
  LOOP
    -- Check if all matches in this phase are finished
    SELECT
      count(*) FILTER (WHERE true),
      count(*) FILTER (WHERE status != 'finished'),
      count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM competition_match_results cmr
        WHERE cmr.match_id = cm.id AND cmr.result_status = 'publicado'
      ))
    INTO v_match_count, v_all_finished, v_all_published
    FROM competition_matches cm
    WHERE cm.phase_id = v_phase.id;

    -- v_all_finished here holds count of NON-finished, v_all_published holds count without published results
    IF v_match_count > 0 AND v_all_finished = 0 AND v_all_published = 0 THEN
      -- All matches finished and all have published results → complete this phase
      UPDATE competition_phases SET status = 'finished', updated_at = now()
      WHERE id = v_phase.id;

      -- Log the transition
      INSERT INTO audit_events (action, table_name, record_id, payload, created_by)
      VALUES (
        'auto_phase_transition',
        'competition_phases',
        v_phase.id::text,
        jsonb_build_object('phase_name', v_phase.name, 'from', 'in_progress', 'to', 'finished', 'sport_event_id', p_sport_event_id),
        auth.uid()
      );

      v_transitions := v_transitions || jsonb_build_object('phase_id', v_phase.id, 'phase_name', v_phase.name, 'action', 'completed');

      -- Check for next phase
      SELECT id, name INTO v_next
      FROM competition_phases
      WHERE sport_event_id = p_sport_event_id
        AND sort_order > v_phase.sort_order
        AND status = 'pending'
      ORDER BY sort_order
      LIMIT 1;

      IF v_next.id IS NOT NULL THEN
        -- Check if next phase has matches created
        IF EXISTS (SELECT 1 FROM competition_matches WHERE phase_id = v_next.id LIMIT 1) THEN
          UPDATE competition_phases SET status = 'in_progress', updated_at = now()
          WHERE id = v_next.id;

          INSERT INTO audit_events (action, table_name, record_id, payload, created_by)
          VALUES (
            'auto_phase_transition',
            'competition_phases',
            v_next.id::text,
            jsonb_build_object('phase_name', v_next.name, 'from', 'pending', 'to', 'in_progress', 'sport_event_id', p_sport_event_id),
            auth.uid()
          );

          v_transitions := v_transitions || jsonb_build_object('phase_id', v_next.id, 'phase_name', v_next.name, 'action', 'started');
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('transitions', v_transitions);
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_check_phase_on_result_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sport_event_id uuid;
BEGIN
  -- Only fire when result_status changes to 'publicado'
  IF NEW.result_status = 'publicado' AND (OLD.result_status IS DISTINCT FROM 'publicado') THEN
    SELECT cm.sport_event_id INTO v_sport_event_id
    FROM competition_matches cm
    WHERE cm.id = NEW.match_id;

    IF v_sport_event_id IS NOT NULL THEN
      PERFORM check_phase_transitions(v_sport_event_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_check_phase_on_result_publish ON competition_match_results;
CREATE TRIGGER trg_check_phase_on_result_publish
  AFTER UPDATE ON competition_match_results
  FOR EACH ROW
  EXECUTE FUNCTION trg_check_phase_on_result_publish();
