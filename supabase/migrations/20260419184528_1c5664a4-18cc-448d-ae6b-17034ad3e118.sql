create table public.help_manual_sections (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'geral',
  title text not null,
  content_md text not null default '',
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index idx_help_manual_sections_order on public.help_manual_sections(category, sort_order);

alter table public.help_manual_sections enable row level security;

create policy "Authenticated can read published sections"
on public.help_manual_sections for select
to authenticated
using (is_published = true or public.has_role(auth.uid(), 'super_admin'));

create policy "Super admin can insert"
on public.help_manual_sections for insert
to authenticated
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Super admin can update"
on public.help_manual_sections for update
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Super admin can delete"
on public.help_manual_sections for delete
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

create or replace function public.tg_help_manual_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger trg_help_manual_touch
before update on public.help_manual_sections
for each row execute function public.tg_help_manual_touch();

insert into public.help_manual_sections (category, title, sort_order, content_md) values
('1. Visão Geral', 'O que é o JER''s Gestão', 10,
E'O **JER''s Gestão** é o sistema oficial de operação dos Jogos Escolares de Roraima. Atua como base operacional de espelhamento dos dados importados do SIGECOM, centralizando credenciamento, logística (alojamento, alimentação, transporte), competição esportiva, justiça desportiva e relatórios oficiais.\n\n**Arquitetura:**\n- Admin Web (SaaS, padrão data-dense) para secretaria, coordenação e administradores.\n- PWAs Operacionais (mobile-first) para alojamento, alimentação, transporte, mesários e delegações.\n- Backend Supabase (PostgreSQL com RLS, Auth, Storage e Edge Functions).\n- Isolamento por evento via `event_id` em todas as operações.'),

('2. Acesso e Perfis', 'Perfis de Usuário', 20,
E'O acesso é feito por e-mail e senha. Cada usuário possui um ou mais perfis que determinam as rotas e funcionalidades disponíveis.\n\n| Perfil | Acesso |\n|---|---|\n| super_admin | Acesso total + monitoramento e diagnóstico |\n| admin | Administração geral do evento |\n| secretaria | Operações administrativas e relatórios |\n| coordenacao_tecnica | Competição completa |\n| coordenador_modalidade | Apenas modalidades atribuídas |\n| mesario | PWA JER Ao Vivo (partidas designadas) |\n| alojamento | PWA Alojamento |\n| alimentacao | PWA Alimentação |\n| transporte | PWA Transporte |\n| delegacao | PWA Delegação (apenas sua delegação) |\n\nEm caso de esquecimento de senha, utilize a opção *Recuperar acesso*.'),

('3. Painel Administrativo', '3.1 Eventos e Etapas', 30,
E'Em **/admin/eventos** é possível criar e gerenciar edições dos jogos. Cada evento pode possuir múltiplas **etapas** (Regional, Estadual, Nacional) com datas, sedes e regras próprias.\n\n⚠️ Sempre confirme o **Evento Ativo** no seletor superior antes de qualquer operação.'),

('3. Painel Administrativo', '3.2 Delegações e Instituições', 31,
E'**/admin/instituicoes** mantém o cadastro mestre de escolas. **/admin/delegacoes** registra a participação da instituição em um evento, com chefe responsável, contatos e situação.'),

('3. Painel Administrativo', '3.3 Participantes e Documentos', 32,
E'**/admin/participantes** lista todos os atletas, técnicos e dirigentes vinculados a delegações. Em cada ficha individual é possível anexar documentos, aprovar/reprovar, consultar histórico, modalidades inscritas e situação de credenciamento.'),

('3. Painel Administrativo', '3.4 Importação SIGECOM', 33,
E'**/admin/importacao** permite carregar planilhas Excel exportadas do SIGECOM.\n\n- Linhas com problemas vão para **/admin/importacao/pendencias**, podendo ser resolvidas manualmente ou via **IA**.\n- A importação é **idempotente**: reimportar não duplica dados.\n- CPF inválido gera pendência mas não bloqueia a importação.'),

('3. Painel Administrativo', '3.5 Credenciamento', 34,
E'**/admin/credenciamento** oferece busca por nome/CPF, check-in, emissão e reemissão de credenciais. Os modelos visuais são configurados em **/admin/credenciais/modelos**. Há também **Credenciamento Externo** para vincular uma credencial física (QR pré-impresso) ao participante.'),

('3. Painel Administrativo', '3.6 Competição', 35,
E'A **Central da Competição** (**/admin/competicao**) reúne configuração de fases, grupos, equipes coletivas, agenda de partidas e resultados.\n\nFluxo de status: `agendada → em andamento → resultado lançado → validado → publicado`.\n\nModalidades de combate (Judô, Karatê, etc.) têm formulário específico com detalhamento (ippon, wazari, hansoku).'),

('3. Painel Administrativo', '3.7 Logística', 36,
E'**Alojamento** (**/admin/alojamento**): cadastro de locais, unidades, capacidades, ocupação e relatórios.\n\n**Alimentação** (**/admin/alimentacao**): tipos de refeição, janelas de consumo, registro e dashboard.\n\n**Transporte** (**/admin/transporte**): veículos, rotas, viagens, embarques e relatórios.\n\nCada módulo possui um PWA correspondente para a operação em campo.'),

('3. Painel Administrativo', '3.8 Pesquisa de Satisfação', 37,
E'**/admin/pesquisa** gerencia eventos de pesquisa, formulários, pesquisadores (com PIN de acesso e local padrão de aplicação) e dashboard com filtro por pesquisador, exportação CSV e relatório de coleta. O preenchimento é feito via PWA quiosque com sincronização offline.'),

('3. Painel Administrativo', '3.9 Relatórios e Boletins', 38,
E'**/admin/relatorios** é o hub de relatórios oficiais (PDF/Excel). Inclui boletins por modalidade (5 layouts), dashboard operacional com KPIs e gráficos, e relatórios específicos de credenciamento, alojamento, alimentação e transporte.\n\nA identidade visual de cada evento é configurada em **/admin/configuracoes/identidade-visual**.'),

('3. Painel Administrativo', '3.10 Justiça Desportiva (CDE)', 39,
E'**/admin/ocorrencias** e o módulo CDE registram incidentes, abrem casos disciplinares, anexam súmulas e evidências, e aplicam sanções. Casos podem ser abertos automaticamente a partir de partidas (cartão vermelho, W.O., ausência) ou manualmente.'),

('4. PWAs Mobile', '4.1 PWA Alojamento', 40,
E'Acesso em `/pwa/alojamento`. Para a equipe que opera os alojamentos. Permite scanear o QR do atleta, registrar check-in/check-out em unidades, validar restrições por gênero e idade, e acompanhar a ocupação em tempo real.'),

('4. PWAs Mobile', '4.2 PWA Alimentação', 41,
E'Acesso em `/pwa/alimentacao`. Operação dos refeitórios. Scanner do QR libera ou bloqueia o consumo conforme a janela de refeição, impedindo duplo consumo na mesma janela.'),

('4. PWAs Mobile', '4.3 PWA Transporte', 42,
E'Acesso em `/pwa/transporte`. Embarque e desembarque em viagens. Lista de manifesto por veículo/rota, scanner do QR para confirmar presença e registro de exceções.'),

('4. PWAs Mobile', '4.4 PWA JER Ao Vivo (Mesário)', 43,
E'Acesso em `/pwa/coordenacao`. Aplicativo dedicado a mesários para registro em tempo real das partidas designadas. Permite lançar placar, eventos (cartões, gols, pontos), encerrar partidas e enviar súmula.'),

('4. PWAs Mobile', '4.5 PWA Delegação', 44,
E'Acesso em `/pwa/delegacao`. Visão restrita para o chefe de delegação acompanhar seus atletas: situação de credenciamento, agenda de partidas, resultados, alojamento e refeições.'),

('5. Ferramentas de IA', '5.1 Chat de Suporte com IA', 50,
E'Disponível em **/admin/ajuda/chat** no menu lateral (grupo Ajuda). Permite tirar dúvidas sobre o uso do sistema.\n\nO chat responde **estritamente com base neste manual**. Quando a pergunta não estiver coberta aqui, ele indicará e sugerirá abrir um chamado.\n\nProvedores em cascata: Anthropic Claude → xAI Grok → DeepSeek.'),

('5. Ferramentas de IA', '5.2 Análise de Pendências de Importação', 51,
E'Em **/admin/importacao/pendencias**, o botão **Analisar com IA** envia as linhas com erro para a Edge Function `ai-resolve-pendencias`. A IA sugere correções (nomes normalizados, modalidades equivalentes, possíveis duplicatas) que o operador pode aprovar ou rejeitar antes de aplicar.'),

('6. Ambiente de Testes', 'Demo Seeds', 60,
E'**/admin/demo-seeds** oferece RPCs para gerar cenários completos de teste por evento. Em **/admin/seed-logistica** é possível semear logística por etapa.\n\n⚠️ Dados de demo são identificados por `seed_tag`. **Nunca** utilize estas RPCs em ambiente de produção.'),

('7. Boas Práticas', 'Operação Diária', 70,
E'- Sempre confirme o **Evento Ativo** antes de qualquer operação.\n- Faça **logout** ao final do expediente em estações compartilhadas.\n- Em PWAs, mantenha o app aberto durante a operação para sincronização contínua.\n- Reporte erros para o suporte com prints e horário.'),

('7. Boas Práticas', 'Segurança', 71,
E'- Não compartilhe credenciais de acesso.\n- Cada operador deve ter seu próprio usuário (rastreabilidade via `created_by/updated_by`).\n- Documentos sensíveis ficam em buckets privados.'),

('7. Boas Práticas', 'Suporte', 72,
E'Use o **Chat de IA** em /admin/ajuda/chat para dúvidas operacionais. Para incidentes técnicos, contate o time de TI da organização com o ID do evento, perfil do usuário e descrição do problema.');