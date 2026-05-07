-- Add policies for tables with RLS enabled but no policies
-- Wrapped in DO blocks to skip tables that may not exist

DO $$ BEGIN
  IF to_regclass('public.participant_event_roles') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participant_event_roles' AND policyname = 'Allow authenticated view of participant_event_roles') THEN
      CREATE POLICY "Allow authenticated view of participant_event_roles" ON public.participant_event_roles FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.participant_national_eligibility') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participant_national_eligibility' AND policyname = 'Allow authenticated view of participant_national_eligibility') THEN
      CREATE POLICY "Allow authenticated view of participant_national_eligibility" ON public.participant_national_eligibility FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.delegation_requests') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'delegation_requests' AND policyname = 'Allow authenticated view of delegation_requests') THEN
      CREATE POLICY "Allow authenticated view of delegation_requests" ON public.delegation_requests FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.disciplinary_cases') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disciplinary_cases' AND policyname = 'Allow authenticated view of disciplinary_cases') THEN
      CREATE POLICY "Allow authenticated view of disciplinary_cases" ON public.disciplinary_cases FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.lodging_supervisions') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lodging_supervisions' AND policyname = 'Allow authenticated view of lodging_supervisions') THEN
      CREATE POLICY "Allow authenticated view of lodging_supervisions" ON public.lodging_supervisions FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.phase_qualification_rules') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'phase_qualification_rules' AND policyname = 'Allow authenticated view of phase_qualification_rules') THEN
      CREATE POLICY "Allow authenticated view of phase_qualification_rules" ON public.phase_qualification_rules FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.document_requirements') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_requirements' AND policyname = 'Allow authenticated view of document_requirements') THEN
      CREATE POLICY "Allow authenticated view of document_requirements" ON public.document_requirements FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.participant_documents') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participant_documents' AND policyname = 'Allow authenticated view of participant_documents') THEN
      CREATE POLICY "Allow authenticated view of participant_documents" ON public.participant_documents FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.disciplinary_sanctions') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disciplinary_sanctions' AND policyname = 'Allow authenticated view of disciplinary_sanctions') THEN
      CREATE POLICY "Allow authenticated view of disciplinary_sanctions" ON public.disciplinary_sanctions FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.jerpa_functional_classifications') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jerpa_functional_classifications' AND policyname = 'Allow authenticated view of jerpa_functional_classifications') THEN
      CREATE POLICY "Allow authenticated view of jerpa_functional_classifications" ON public.jerpa_functional_classifications FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.jerpa_support_needs') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jerpa_support_needs' AND policyname = 'Allow authenticated view of jerpa_support_needs') THEN
      CREATE POLICY "Allow authenticated view of jerpa_support_needs" ON public.jerpa_support_needs FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.state_selection_callups') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'state_selection_callups' AND policyname = 'Allow authenticated view of state_selection_callups') THEN
      CREATE POLICY "Allow authenticated view of state_selection_callups" ON public.state_selection_callups FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;
