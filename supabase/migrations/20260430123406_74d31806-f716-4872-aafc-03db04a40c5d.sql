CREATE TABLE public.osc_accountability_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  prompt_structure TEXT NOT NULL,
  category TEXT DEFAULT 'technical',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.osc_accountability_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Templates are viewable by authenticated users" 
ON public.osc_accountability_templates 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage templates" 
ON public.osc_accountability_templates 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_osc_accountability_templates_updated_at
BEFORE UPDATE ON public.osc_accountability_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default templates
INSERT INTO public.osc_accountability_templates (name, description, prompt_structure, category, is_default)
VALUES 
(
  'Relatório Técnico Padrão', 
  'Estrutura formal focada em metas e execução física do objeto.', 
  'ESTRUTURA NARRATIVA:\n1. INTRODUÇÃO: Contextualize o evento e a importância social.\n2. METAS ATINGIDAS: Relacione os números (participantes e partidas) com o sucesso do convênio.\n3. EXECUÇÃO OPERACIONAL: Descreva como os recursos foram aplicados.\n4. EVIDÊNCIAS FÍSICAS: Comente sobre a conformidade das fotos.\n5. CONCLUSÃO: Parecer sobre a plena execução.', 
  'technical',
  true
),
(
  'Relatório de Impacto Social', 
  'Focado na transformação social e depoimentos implícitos.', 
  'ESTRUTURA NARRATIVA:\n1. RESUMO EXECUTIVO: O impacto gerado na comunidade.\n2. PERFIL DO PÚBLICO: Análise qualitativa dos participantes.\n3. RESULTADOS ALCANÇADOS: Além dos números, o que mudou?\n4. CONCLUSÃO E PRÓXIMOS PASSOS.', 
  'social',
  false
),
(
  'Relatório Financeiro/Operacional', 
  'Focado na logística e aplicação de recursos.', 
  'ESTRUTURA NARRATIVA:\n1. LOGÍSTICA DE EXECUÇÃO: Detalhamento de transporte e alimentação.\n2. RECURSOS HUMANOS E MATERIAIS: Como a equipe e materiais foram utilizados.\n3. EFICIÊNCIA OPERACIONAL: Análise da relação custo-benefício da execução física.\n4. NOTAS FINAIS.', 
  'financial',
  false
);