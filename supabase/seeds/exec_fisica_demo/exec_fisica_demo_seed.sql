-- =====================================================================
-- SEED DEMO — Execução Física (Alimentação + Alojamento + Cobertura)
-- =====================================================================
-- OBJETIVO: popular dados REALISTAS de TESTE para validar a tela do
-- Relatório de Execução Física. NÃO é dado oficial.
--
-- ⚠️ AVISOS IMPORTANTES
-- 1. Este script roda no PROJETO PRINCIPAL (produção). A função
--    get_osc_execucao_fisica NÃO filtra seed — refeições e cobertura de
--    etapas inseridas aqui APARECEM no relatório oficial até serem
--    removidas. Use o exec_fisica_demo_cleanup.sql antes de qualquer
--    geração oficial para o IDJUV (ou peça o filtro de segurança no
--    relatório).
-- 2. Tudo é marcado com o batch UUID abaixo. Nada fica "escondido":
--    o objetivo é ser 100% rastreável e removível.
-- 3. Idempotente: pode rodar mais de uma vez (usa NOT EXISTS / CONTINUE).
--
-- Marcadores por tabela:
--   meal_consumptions      -> method='seed_demo', device_info.seed_batch_id
--   lodging_locations/units-> seed_batch_id + seed_tag='exec_fisica_demo'
--   lodging_occupancies    -> metadata.seed_batch_id
--   participant_event_stages-> created_by = <batch uuid>
-- =====================================================================

-- ---------------------------------------------------------------------
-- SEÇÃO 1 — ALIMENTAÇÃO
-- Gera consumos para ~90% dos atletas realmente vinculados a cada etapa,
-- em cada janela de refeição existente da etapa, sem duplicar.
-- ---------------------------------------------------------------------
do $$
declare
  v_event uuid := (select id from public.events order by created_at limit 1);
  v_batch uuid := '00000000-5eed-4000-8000-000000000001';
  v_inserted bigint;
begin
  insert into public.meal_consumptions
    (meal_window_id, participant_id, consumed_at, method, status, notes, device_info)
  select
    mw.id,
    p.id,
    (mw.service_date + coalesce(mw.start_time, time '12:00'))::timestamptz
      + (random() * interval '40 minutes'),
    'seed_demo',
    'active',
    'SEED_BATCH:' || v_batch::text,
    jsonb_build_object('seed_batch_id', v_batch)
  from public.meal_windows mw
  join public.participant_event_stages pes on pes.event_stage_id = mw.event_stage_id
  join public.participants p on p.id = pes.participant_id
  where mw.event_id = v_event
    and p.event_id = v_event
    and p.participant_type = 'athlete'
    and coalesce(p.is_active, true) = true
    and random() < 0.90
    and not exists (
      select 1 from public.meal_consumptions mc
      where mc.meal_window_id = mw.id and mc.participant_id = p.id
    );
  get diagnostics v_inserted = row_count;
  raise notice '[seed alimentação] % consumos inseridos', v_inserted;
end $$;

-- ---------------------------------------------------------------------
-- SEÇÃO 2 — ALOJAMENTO
-- Para cada etapa com atletas que precisam de alojamento, cria 1 local
-- demo + quartos (capacidade 30) e aloca os atletas (status checked_in).
-- ⚠️ status 'checked_in' pode disparar trigger de movimentação de colchão
--    (lodging_mattress_movements). Se preferir evitar, troque por
--    'allocated' na linha indicada.
-- ---------------------------------------------------------------------
do $$
declare
  v_event uuid := (select id from public.events order by created_at limit 1);
  v_batch uuid := '00000000-5eed-4000-8000-000000000001';
  v_cap   int  := 30;
  r record;
  v_loc uuid;
begin
  for r in
    select es.id as stage_id, es.name, es.starts_at,
           count(distinct p.id) as athletes
    from public.event_stages es
    join public.participant_event_stages pes on pes.event_stage_id = es.id
    join public.participants p on p.id = pes.participant_id
    where es.event_id = v_event
      and p.event_id = v_event
      and p.participant_type = 'athlete'
      and p.needs_lodging = true
      and coalesce(p.is_active, true) = true
    group by es.id, es.name, es.starts_at
    having count(distinct p.id) > 0
  loop
    -- pula se já existe local seed para a etapa (idempotência)
    if exists (
      select 1 from public.lodging_locations l
      where l.event_stage_id = r.stage_id and l.seed_batch_id = v_batch
    ) then
      continue;
    end if;

    insert into public.lodging_locations
      (event_id, event_stage_id, name, is_active, seed_tag, seed_batch_id)
    values
      (v_event, r.stage_id, 'Alojamento Demo - ' || r.name, true, 'exec_fisica_demo', v_batch)
    returning id into v_loc;

    insert into public.lodging_units
      (location_id, event_id, event_stage_id, name, capacity, gender_restriction, is_active, seed_tag, seed_batch_id)
    select v_loc, v_event, r.stage_id, 'Quarto ' || g, v_cap, 'mixed', true, 'exec_fisica_demo', v_batch
    from generate_series(1, ceil(r.athletes::numeric / v_cap)::int) g;

    with ath as (
      select p.id as pid, row_number() over (order by p.id) rn
      from public.participants p
      join public.participant_event_stages pes
        on pes.participant_id = p.id and pes.event_stage_id = r.stage_id
      where p.event_id = v_event
        and p.participant_type = 'athlete'
        and p.needs_lodging = true
        and coalesce(p.is_active, true) = true
    ),
    u as (
      select id as uid, row_number() over (order by name) urn
      from public.lodging_units
      where event_stage_id = r.stage_id and seed_batch_id = v_batch
    )
    insert into public.lodging_occupancies
      (unit_id, event_id, event_stage_id, participant_id, status, checked_in_at, notes, metadata)
    select
      u.uid, v_event, r.stage_id, ath.pid,
      'checked_in',  -- <<< troque por 'allocated' para evitar triggers de check-in
      coalesce(r.starts_at, current_date)::timestamptz + interval '14 hours',
      'SEED_BATCH:' || v_batch::text,
      jsonb_build_object('seed_batch_id', v_batch)
    from ath
    join u on u.urn = ceil(ath.rn::numeric / v_cap)::int
    where not exists (
      select 1 from public.lodging_occupancies o
      where o.participant_id = ath.pid and o.event_stage_id = r.stage_id
    );

    raise notice '[seed alojamento] etapa % (% atletas) alojada', r.name, r.athletes;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- SEÇÃO 3 — COBERTURA DE ETAPAS  (a parte MAIS sintética — revise!)
-- Vincula atletas a etapas que hoje estão SEM nenhum participante
-- (ex.: fases finais, etapas de teste). Marca via created_by = batch.
-- Por padrão liga, a cada etapa vazia, os atletas de até 5 delegações.
-- ---------------------------------------------------------------------
do $$
declare
  v_event uuid := (select id from public.events order by created_at limit 1);
  v_batch uuid := '00000000-5eed-4000-8000-000000000001';
  r record;
  v_inserted bigint;
begin
  for r in
    select es.id as stage_id, es.name
    from public.event_stages es
    where es.event_id = v_event
      and coalesce(es.kind,'') <> 'legado'
      and not exists (
        select 1 from public.participant_event_stages pes where pes.event_stage_id = es.id
      )
  loop
    insert into public.participant_event_stages
      (participant_id, event_stage_id, event_id, status, created_by)
    select p.id, r.stage_id, v_event, 'active', v_batch
    from public.participants p
    where p.event_id = v_event
      and p.participant_type = 'athlete'
      and coalesce(p.is_active, true) = true
      and p.delegation_id in (
        select d.id from public.delegations d
        where d.event_id = v_event order by d.created_at limit 5
      )
      and not exists (
        select 1 from public.participant_event_stages x
        where x.participant_id = p.id and x.event_stage_id = r.stage_id
      );
    get diagnostics v_inserted = row_count;
    raise notice '[seed cobertura] etapa % recebeu % atletas', r.name, v_inserted;
  end loop;
end $$;
