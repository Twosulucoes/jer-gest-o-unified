CREATE OR REPLACE FUNCTION public.tg_validate_team_institution_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules_row sport_event_rules%ROWTYPE;
  v_gender_scope text;
  v_max_teams int;
  v_current int;
BEGIN
  IF NEW.sport_event_id IS NULL OR NEW.delegation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rules_row
  FROM sport_event_rules
  WHERE sport_event_id = NEW.sport_event_id AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- gender_scope mora em categories, não em sport_events
  SELECT c.gender_scope INTO v_gender_scope
  FROM sport_events se
  JOIN categories c ON c.id = se.category_id
  WHERE se.id = NEW.sport_event_id;

  v_max_teams := CASE
    WHEN v_gender_scope = 'female' THEN v_rules_row.institution_max_female
    WHEN v_gender_scope = 'male'   THEN v_rules_row.institution_max_male
    ELSE COALESCE(v_rules_row.institution_max_male, v_rules_row.institution_max_female)
  END;

  IF v_max_teams IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_current
  FROM teams t
  WHERE t.sport_event_id = NEW.sport_event_id
    AND t.delegation_id = NEW.delegation_id
    AND (TG_OP = 'INSERT' OR t.id <> NEW.id)
    AND COALESCE(t.is_active, true) = true;

  IF v_current >= v_max_teams THEN
    RAISE EXCEPTION 'INSTITUTION_LIMIT_EXCEEDED: instituicao ja possui % equipe(s) (limite=%) nesta prova', v_current, v_max_teams
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;