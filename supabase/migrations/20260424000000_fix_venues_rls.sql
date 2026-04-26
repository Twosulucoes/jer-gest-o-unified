-- Habilitar RLS na tabela venues
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar erros de duplicidade
DROP POLICY IF EXISTS "Admin full access venues" ON public.venues;
DROP POLICY IF EXISTS "Secretaria manage venues" ON public.venues;
DROP POLICY IF EXISTS "Coordenacao tecnica read venues" ON public.venues;
DROP POLICY IF EXISTS "Authenticated users can read venues" ON public.venues;

-- Admin: acesso total
CREATE POLICY "Admin full access venues"
  ON public.venues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Secretaria: gerenciar locais
CREATE POLICY "Secretaria manage venues"
  ON public.venues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'secretaria'))
  WITH CHECK (public.has_role(auth.uid(), 'secretaria'));

-- Coordenação Técnica: leitura
CREATE POLICY "Coordenacao tecnica read venues"
  ON public.venues FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenacao_tecnica'));

-- Usuários autenticados em geral: leitura
CREATE POLICY "Authenticated users can read venues"
  ON public.venues FOR SELECT TO authenticated
  USING (true);
