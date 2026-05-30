-- =====================================================================
-- Relatório de Execução Física das Metas (OSC -> IDJUV/SEI)
-- Somente execução FÍSICA. Nenhum dado financeiro.
-- =====================================================================

-- 1) Tabela de METAS PREVISTAS (Plano de Trabalho), editável na UI.
create table if not exists public.osc_meta_targets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  meta_number smallint not null check (meta_number in (1,2)),
  metric_key text not null,
  event_stage_id uuid references public.event_stages(id) on delete cascade,
  valor_previsto numeric not null default 0,
  unidade text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create unique index if not exists osc_meta_targets_uniq
  on public.osc_meta_targets (
    event_id, meta_number, metric_key,
    coalesce(event_stage_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists osc_meta_targets_event_idx
  on public.osc_meta_targets (event_id);

alter table public.osc_meta_targets enable row level security;

-- Leitura: perfis autorizados (mesmo conjunto da prestação de contas OSC)
create policy "OSC meta targets visíveis para perfis autorizados"
  on public.osc_meta_targets for select
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = any (array[
          'admin'::app_role, 'secretaria'::app_role,
          'super_admin'::app_role, 'coordenacao_tecnica'::app_role
        ])
    )
  );

-- Escrita: admin, secretaria e super_admin
create policy "OSC meta targets editáveis por admin e secretaria"
  on public.osc_meta_targets for all
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = any (array[
          'admin'::app_role, 'secretaria'::app_role, 'super_admin'::app_role
        ])
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = any (array[
          'admin'::app_role, 'secretaria'::app_role, 'super_admin'::app_role
        ])
    )
  );

create policy "Super admin acesso total osc_meta_targets"
  on public.osc_meta_targets for all
  using (has_role(auth.uid(), 'super_admin'::app_role))
  with check (has_role(auth.uid(), 'super_admin'::app_role));

-- 2) VIEW transparência: Meta 1 (apoio às delegações) por etapa regional / cidade-sede.
create or replace view public.vw_osc_meta1_por_etapa
with (security_invoker = on) as
select
  es.event_id,
  es.id as event_stage_id,
  es.name as stage_name,
  coalesce(es.host_city, es.host_name, es.name) as host_city,
  es.stage_code,
  es.kind,
  es.sort_order,
  es.starts_at,
  es.ends_at,
  (select count(distinct p.delegation_id)
     from public.participant_event_stages pes
     join public.participants p on p.id = pes.participant_id
    where pes.event_stage_id = es.id and p.delegation_id is not null)::int as delegacoes_atendidas,
  (select count(distinct p.id)
     from public.participant_event_stages pes
     join public.participants p on p.id = pes.participant_id
    where pes.event_stage_id = es.id
      and p.participant_type = 'athlete' and p.needs_lodging = true)::int as atletas_alojados,
  (select count(*)
     from public.meal_consumptions mc
     join public.meal_windows mw on mw.id = mc.meal_window_id
    where mw.event_stage_id = es.id
      and coalesce(mc.status, 'active') <> 'cancelado')::int as refeicoes_fornecidas,
  (select count(distinct pc.id)
     from public.participant_credentials pc
     join public.participant_event_stages pes on pes.participant_id = pc.participant_id
    where pes.event_stage_id = es.id and pc.status = 'active')::int as kits_entregues
from public.event_stages es;

-- 3) VIEW transparência: Meta 2 (competições) executado.
create or replace view public.vw_osc_meta2_competicoes
with (security_invoker = on) as
select
  e.id as event_id,
  (select count(distinct s.id) from public.sports s
     where s.event_id = e.id
       and exists (
         select 1 from public.sport_events se
         join public.competition_matches cm on cm.sport_event_id = se.id
         where se.sport_id = s.id and cm.status in ('completed','finished')
       ))::int as modalidades_realizadas,
  (select count(distinct s.id) from public.sports s
     where s.event_id = e.id and s.is_paralympic = true
       and exists (
         select 1 from public.sport_events se
         join public.competition_matches cm on cm.sport_event_id = se.id
         where se.sport_id = s.id and cm.status in ('completed','finished')
       ))::int as modalidades_paralimpicas,
  (select count(*) from public.event_stages es
     where es.event_id = e.id and coalesce(es.kind,'') <> 'legado')::int as etapas,
  (select count(*) from public.competition_matches cm
     where cm.event_id = e.id and cm.status in ('completed','finished'))::int as jogos_provas,
  (select count(distinct mo.id) from public.match_officials mo
     join public.competition_matches cm on cm.id = mo.match_id
     where cm.event_id = e.id)::int as arbitros
from public.events e;

-- 4) FUNÇÃO principal consumida pelo app: retorna o JSON completo do relatório.
create or replace function public.get_osc_execucao_fisica(
  p_event_id uuid,
  p_date_from date default null,
  p_date_to date default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with meta1 as (
    select
      es.id as event_stage_id,
      es.name as stage_name,
      coalesce(es.host_city, es.host_name, es.name) as host_city,
      es.stage_code,
      es.kind,
      es.starts_at,
      es.ends_at,
      (select count(distinct p.delegation_id)
         from participant_event_stages pes
         join participants p on p.id = pes.participant_id
        where pes.event_stage_id = es.id and p.delegation_id is not null)::int as delegacoes_atendidas,
      (select count(distinct p.id)
         from participant_event_stages pes
         join participants p on p.id = pes.participant_id
        where pes.event_stage_id = es.id
          and p.participant_type = 'athlete' and p.needs_lodging = true)::int as atletas_alojados,
      (select count(*)
         from meal_consumptions mc
         join meal_windows mw on mw.id = mc.meal_window_id
        where mw.event_stage_id = es.id
          and coalesce(mc.status,'active') <> 'cancelado'
          and (p_date_from is null or mc.consumed_at::date >= p_date_from)
          and (p_date_to is null or mc.consumed_at::date <= p_date_to))::int as refeicoes_fornecidas,
      (select count(distinct pc.id)
         from participant_credentials pc
         join participant_event_stages pes on pes.participant_id = pc.participant_id
        where pes.event_stage_id = es.id and pc.status = 'active')::int as kits_entregues
    from event_stages es
    where es.event_id = p_event_id
    order by es.sort_order nulls last, es.name
  ),
  meta1_totals as (
    select
      (select count(distinct p.delegation_id)
         from participant_event_stages pes
         join participants p on p.id = pes.participant_id
        where p.event_id = p_event_id and p.delegation_id is not null)::int as delegacoes_atendidas,
      (select count(distinct p.id)
         from participant_event_stages pes
         join participants p on p.id = pes.participant_id
        where p.event_id = p_event_id
          and p.participant_type = 'athlete' and p.needs_lodging = true)::int as atletas_alojados,
      (select count(*)
         from meal_consumptions mc
         join meal_windows mw on mw.id = mc.meal_window_id
        where mw.event_id = p_event_id
          and coalesce(mc.status,'active') <> 'cancelado'
          and (p_date_from is null or mc.consumed_at::date >= p_date_from)
          and (p_date_to is null or mc.consumed_at::date <= p_date_to))::int as refeicoes_fornecidas,
      (select count(distinct pc.id)
         from participant_credentials pc
        where pc.event_id = p_event_id and pc.status = 'active')::int as kits_entregues
  ),
  meta2_exec as (
    select * from vw_osc_meta2_competicoes where event_id = p_event_id
  ),
  targets as (
    select metric_key, sum(valor_previsto)::numeric as previsto
    from osc_meta_targets
    where event_id = p_event_id and meta_number = 2
    group by metric_key
  ),
  meta2 as (
    select jsonb_agg(row) as arr from (
      select jsonb_build_object(
        'metric_key', m.metric_key,
        'label', m.label,
        'previsto', coalesce(t.previsto, 0),
        'executado', m.executado
      ) as row
      from (
        select 'modalidades' as metric_key, 'Modalidades realizadas' as label,
               coalesce((select modalidades_realizadas from meta2_exec),0) as executado, 1 as ord
        union all select 'modalidades_paralimpicas', 'Modalidades paralímpicas (JERPA)',
               coalesce((select modalidades_paralimpicas from meta2_exec),0), 2
        union all select 'etapas', 'Etapas realizadas',
               coalesce((select etapas from meta2_exec),0), 3
        union all select 'jogos_provas', 'Jogos / provas',
               coalesce((select jogos_provas from meta2_exec),0), 4
        union all select 'arbitros', 'Árbitros mobilizados',
               coalesce((select arbitros from meta2_exec),0), 5
      ) m
      left join targets t on t.metric_key = m.metric_key
      order by m.ord
    ) s
  )
  select jsonb_build_object(
    'identificacao', (
      select jsonb_build_object(
        'event_id', e.id,
        'event_name', e.name,
        'event_year', e.year,
        'event_start', e.start_date,
        'event_end', e.end_date,
        'periodo_de', p_date_from,
        'periodo_ate', p_date_to,
        'termo_fomento', coalesce(oc.contract_number,'01') || '/' || coalesce(oc.contract_year, e.year::text, '2026'),
        'objeto', e.name,
        'osc_name', oc.osc_name,
        'osc_cnpj', oc.osc_cnpj,
        'osc_address', oc.osc_address,
        'grantor_name', oc.grantor_name,
        'responsible_name', oc.responsible_name,
        'validity_start', oc.validity_start,
        'validity_end', oc.validity_end
      )
      from events e
      left join event_osc_configs oc on oc.event_id = e.id
      where e.id = p_event_id
    ),
    'meta1', jsonb_build_object(
      'por_etapa', coalesce((select jsonb_agg(to_jsonb(m1)) from meta1 m1), '[]'::jsonb),
      'total', (select to_jsonb(t) from meta1_totals t)
    ),
    'meta2', coalesce((select arr from meta2), '[]'::jsonb),
    'evidencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'osc_category', oe.osc_category,
        'count', oe.cnt
      ) order by oe.osc_category), '[]'::jsonb)
      from (
        select osc_category, count(*) cnt
        from operational_evidence
        where event_id = p_event_id and status = 'approved' and osc_category is not null
        group by osc_category
      ) oe
    ),
    'generated_at', now()
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_osc_execucao_fisica(uuid, date, date) to authenticated;
