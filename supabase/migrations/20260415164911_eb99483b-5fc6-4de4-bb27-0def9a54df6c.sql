
-- Create event_edition_rules table
CREATE TABLE public.event_edition_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  published_at TIMESTAMPTZ,
  published_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(event_id, version)
);

-- Enable RLS
ALTER TABLE public.event_edition_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view event rules"
  ON public.event_edition_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert event rules"
  ON public.event_edition_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update event rules"
  ON public.event_edition_rules FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_event_edition_rules_updated_at
  BEFORE UPDATE ON public.event_edition_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit log table
CREATE TABLE public.event_rules_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  edition_rules_id UUID REFERENCES public.event_edition_rules(id) ON DELETE SET NULL,
  section TEXT NOT NULL,
  action TEXT NOT NULL,
  changes_summary TEXT,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_rules_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view audit log"
  ON public.event_rules_audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit log"
  ON public.event_rules_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_event_edition_rules_event_id ON public.event_edition_rules(event_id);
CREATE INDEX idx_event_edition_rules_status ON public.event_edition_rules(event_id, status);
CREATE INDEX idx_event_rules_audit_event ON public.event_rules_audit_log(event_id);
