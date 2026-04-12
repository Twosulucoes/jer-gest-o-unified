
-- Create public_content table
CREATE TABLE public.public_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('external_link','public_page','redirect')),
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  destination_url text,
  content_md text,
  open_in_new_tab boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted')),
  sort_order int NOT NULL DEFAULT 0,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT uq_public_content_kind_slug UNIQUE (kind, slug)
);

-- Validation triggers (instead of CHECK constraints with subqueries)
CREATE OR REPLACE FUNCTION public.validate_public_content()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.kind IN ('external_link','redirect') AND NEW.destination_url IS NULL THEN
    RAISE EXCEPTION 'destination_url is required for kind=%', NEW.kind;
  END IF;
  IF NEW.kind = 'public_page' AND NEW.content_md IS NULL THEN
    RAISE EXCEPTION 'content_md is required for kind=public_page';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_public_content
BEFORE INSERT OR UPDATE ON public.public_content
FOR EACH ROW EXECUTE FUNCTION public.validate_public_content();

-- Indexes
CREATE INDEX idx_public_content_active_kind ON public.public_content (active, kind);
CREATE INDEX idx_public_content_slug ON public.public_content (slug);
CREATE INDEX idx_public_content_sort ON public.public_content (sort_order);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_public_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_public_content_updated_at
BEFORE UPDATE ON public.public_content
FOR EACH ROW EXECUTE FUNCTION public.set_public_content_updated_at();

-- Enable RLS
ALTER TABLE public.public_content ENABLE ROW LEVEL SECURITY;

-- Anon: only active + public
CREATE POLICY "Anon can read active public content"
ON public.public_content FOR SELECT TO anon
USING (active = true AND visibility = 'public');

-- Authenticated: active + public or unlisted
CREATE POLICY "Auth can read active public or unlisted content"
ON public.public_content FOR SELECT TO authenticated
USING (
  (active = true AND visibility IN ('public','unlisted'))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'secretaria'::app_role)
);

-- Admin full access
CREATE POLICY "Admin full access public_content"
ON public.public_content FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Secretaria full access
CREATE POLICY "Secretaria full access public_content"
ON public.public_content FOR ALL TO authenticated
USING (has_role(auth.uid(), 'secretaria'::app_role))
WITH CHECK (has_role(auth.uid(), 'secretaria'::app_role));

-- Seed data: PWA redirects
INSERT INTO public.public_content (kind, slug, title, destination_url, sort_order, open_in_new_tab) VALUES
  ('redirect', 'pwa-transporte', 'PWA Transporte', 'https://adm.jers.com.br/pwa/transporte', 1, false),
  ('redirect', 'pwa-alimentacao', 'PWA Alimentação', 'https://adm.jers.com.br/pwa/alimentacao', 2, false),
  ('redirect', 'pwa-coordenacao-tecnica', 'PWA Coordenação Técnica', 'https://adm.jers.com.br/pwa/coordenacao-tecnica', 3, false),
  ('redirect', 'pwa-delegacao', 'PWA Delegação', 'https://adm.jers.com.br/pwa/delegacao', 4, false),
  ('redirect', 'pwa-pesquisa', 'PWA Pesquisa', 'https://adm.jers.com.br/pwa/pesquisa/login', 5, false);

-- Seed: Links Oficiais public page
INSERT INTO public.public_content (kind, slug, title, content_md, sort_order, open_in_new_tab) VALUES
  ('public_page', 'links', 'Links Oficiais — JER Gestão', E'# Links Oficiais — JER Gestão\n\nAcesse os módulos do sistema:\n\n- [PWA Transporte](/go/pwa-transporte)\n- [PWA Alimentação](/go/pwa-alimentacao)\n- [PWA Coordenação Técnica](/go/pwa-coordenacao-tecnica)\n- [PWA Delegação](/go/pwa-delegacao)\n- [PWA Pesquisa](/go/pwa-pesquisa)\n', 0, false);
