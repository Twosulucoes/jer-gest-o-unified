-- Fix RLS for missing tables
DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false) 
    LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP; 
END $$;

-- Helper function to check if user is admin or secretaria
CREATE OR REPLACE FUNCTION public.check_is_admin_or_secretaria(_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'secretaria')
      AND p.active = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Basic policies for administrative and support tables
CREATE POLICY "Super admins can do everything on import_aliases" ON public.import_aliases FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Admins can view import_aliases" ON public.import_aliases FOR SELECT USING (check_is_admin_or_secretaria(auth.uid()));

CREATE POLICY "Users can view their own support tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = created_by OR check_is_admin_or_secretaria(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can create support tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Super admins can manage system config" ON public.system_config FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Authenticated users can view system config" ON public.system_config FOR SELECT USING (auth.role() = 'authenticated');

-- Referential Integrity Triggers
CREATE OR REPLACE FUNCTION public.check_event_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- If table has event_id, ensure related entities match it
  IF TG_TABLE_NAME = 'participants' AND NEW.delegation_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.delegations WHERE id = NEW.delegation_id AND event_id = NEW.event_id) THEN
      RAISE EXCEPTION 'A delegação informada não pertence ao mesmo evento do participante.';
    END IF;
  END IF;
  
  IF TG_TABLE_NAME = 'participant_sport_events' THEN
    IF NOT EXISTS (
      SELECT 1 
      FROM public.participants p 
      JOIN public.sport_events se ON se.event_id = p.event_id 
      WHERE p.id = NEW.participant_id AND se.id = NEW.sport_event_id
    ) THEN
      RAISE EXCEPTION 'A prova/modalidade informada não pertence ao evento do participante.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply consistency triggers (DROP if exists to avoid error if already applied partially)
DROP TRIGGER IF EXISTS trg_check_participant_consistency ON public.participants;
CREATE TRIGGER trg_check_participant_consistency BEFORE INSERT OR UPDATE ON public.participants FOR EACH ROW EXECUTE FUNCTION public.check_event_consistency();

DROP TRIGGER IF EXISTS trg_check_pse_consistency ON public.participant_sport_events;
CREATE TRIGGER trg_check_pse_consistency BEFORE INSERT OR UPDATE ON public.participant_sport_events FOR EACH ROW EXECUTE FUNCTION public.check_event_consistency();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participants_event_delegation ON public.participants (event_id, delegation_id);
CREATE INDEX IF NOT EXISTS idx_pse_participant_event ON public.participant_sport_events (participant_id, sport_event_id);

-- CPF Constraint (ensure uniqueness in people table)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_cpf_person ON public.people (cpf) WHERE cpf IS NOT NULL AND cpf <> '';

-- Cleanup sensitive views
ALTER VIEW public.vw_person_logistics_consumption SET (security_invoker = on);
ALTER VIEW public.vw_participant_sport_history SET (security_invoker = on);
ALTER VIEW public.public_results_view SET (security_invoker = on);
