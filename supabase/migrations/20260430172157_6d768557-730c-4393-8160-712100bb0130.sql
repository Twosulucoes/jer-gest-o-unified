-- Adicionar colunas extras para suporte a cards interativos
ALTER TABLE public.help_manual_sections ADD COLUMN IF NOT EXISTS link_path TEXT;
ALTER TABLE public.help_manual_sections ADD COLUMN IF NOT EXISTS action_label TEXT;

-- Criar tabela de progresso
CREATE TABLE IF NOT EXISTS public.admin_manual_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.help_manual_sections(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, section_id)
);

-- Habilitar RLS
ALTER TABLE public.admin_manual_progress ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários podem ver seu próprio progresso"
ON public.admin_manual_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem registrar seu próprio progresso"
ON public.admin_manual_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seu próprio progresso"
ON public.admin_manual_progress
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_manual_progress_updated_at
BEFORE UPDATE ON public.admin_manual_progress
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Inserir os 8 cards de Primeiros Passos
-- Usando DO block para evitar erros se já existirem (embora improvável com IDs fixos ou deletando antes)
DELETE FROM public.help_manual_sections WHERE category = '0. Primeiros Passos';

INSERT INTO public.help_manual_sections (category, title, content_md, sort_order, is_published, link_path, action_label)
VALUES 
('0. Primeiros Passos', 'Configurar seu Evento', 'O ponto de partida. Aqui você define o nome, datas e configurações globais do evento JER. Sem isso, as outras etapas não podem ser vinculadas.', 1, true, '/admin/eventos', 'Ir para Eventos'),
('0. Primeiros Passos', 'Base de Participantes', 'Visualize e gerencie todos os participantes cadastrados. É essencial validar quem está no sistema antes de iniciar as importações específicas.', 2, true, '/admin/participantes', 'Gerenciar Pessoas'),
('0. Primeiros Passos', 'Importação de Inscrições', 'Use nossas planilhas modelo para trazer grandes volumes de dados de uma só vez. Organize atletas, equipes e comissões técnicas rapidamente.', 3, true, '/admin/importacao', 'Iniciar Importação'),
('0. Primeiros Passos', 'Registros e Prestação de Contas', 'Módulo dedicado ao controle de OSCs e registros formais. Garanta que toda a documentação e dados financeiros básicos estejam em conformidade.', 4, true, '/admin/registros', 'Acessar Registros'),
('0. Primeiros Passos', 'Regras e Normas', 'Defina os regulamentos que regem as competições. As regras configuradas aqui orientam o comportamento do sistema durante os lançamentos de resultados.', 5, true, '/admin/regras', 'Configurar Regras'),
('0. Primeiros Passos', 'Painel de Conformidade', 'Monitore a saúde dos dados e identifique pendências críticas. Ideal para garantir que nada foi esquecido antes do início oficial da etapa.', 6, true, '/admin/conformidade', 'Ver Conformidade'),
('0. Primeiros Passos', 'Gestão de Etapas', 'Onde a operação acontece. Escolha uma etapa para gerenciar o credenciamento, alojamento, alimentação e transporte dos participantes.', 7, true, '/admin/etapas', 'Explorar Etapas'),
('0. Primeiros Passos', 'Relatórios Operacionais', 'Visualize o resumo de tudo o que está acontecendo. Gere PDFs e dashboards para acompanhamento em tempo real da execução do evento.', 8, true, '/admin/relatorios/dashboard', 'Abrir Dashboard');
