-- Tabela de chamados técnicos (Suporte)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_name text,
  reporter_email text,
  category text NOT NULL DEFAULT 'duvida', -- bug | duvida | melhoria | acesso | outro
  priority text NOT NULL DEFAULT 'normal', -- baixa | normal | alta | critica
  status text NOT NULL DEFAULT 'aberto',   -- aberto | em_analise | resolvido | fechado
  subject text NOT NULL,
  description text NOT NULL,
  current_url text,
  user_agent text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON public.support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_support_tickets_event ON public.support_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Comentários (thread)
CREATE TABLE IF NOT EXISTS public.support_ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_internal boolean NOT NULL DEFAULT false, -- nota interna do super admin
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_comments_ticket ON public.support_ticket_comments(ticket_id, created_at);

ALTER TABLE public.support_ticket_comments ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== RLS support_tickets =====
-- Autor pode ver seus próprios chamados
CREATE POLICY "ticket_author_select"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = created_by);

-- Super admin vê tudo
CREATE POLICY "ticket_super_admin_select"
  ON public.support_tickets FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Qualquer usuário autenticado pode abrir um chamado (o created_by deve ser ele mesmo)
CREATE POLICY "ticket_authenticated_insert"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Autor pode atualizar somente o próprio chamado se ainda estiver aberto
CREATE POLICY "ticket_author_update"
  ON public.support_tickets FOR UPDATE
  USING (auth.uid() = created_by AND status = 'aberto')
  WITH CHECK (auth.uid() = created_by);

-- Super admin pode atualizar qualquer chamado
CREATE POLICY "ticket_super_admin_update"
  ON public.support_tickets FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Super admin pode excluir
CREATE POLICY "ticket_super_admin_delete"
  ON public.support_tickets FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ===== RLS support_ticket_comments =====
-- Ver comentários: super admin vê tudo; autor do ticket vê comentários não internos
CREATE POLICY "comments_super_admin_select"
  ON public.support_ticket_comments FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "comments_ticket_author_select"
  ON public.support_ticket_comments FOR SELECT
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.created_by = auth.uid()
    )
  );

-- Inserir comentários: super admin sempre; autor do ticket apenas se não for nota interna
CREATE POLICY "comments_super_admin_insert"
  ON public.support_ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND author_id = auth.uid());

CREATE POLICY "comments_ticket_author_insert"
  ON public.support_ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.created_by = auth.uid()
    )
  );