-- =====================================================================
-- LIMPEZA do SEED DEMO de Execução Física
-- Remove 100% dos dados inseridos pelo exec_fisica_demo_seed.sql,
-- identificados pelo batch UUID. Ordem respeita as FKs.
-- =====================================================================
do $$
declare
  v_batch uuid := '00000000-5eed-4000-8000-000000000001';
  n bigint;
begin
  delete from public.meal_consumptions
   where method = 'seed_demo'
      or device_info->>'seed_batch_id' = v_batch::text;
  get diagnostics n = row_count; raise notice 'meal_consumptions removidos: %', n;

  delete from public.lodging_occupancies
   where metadata->>'seed_batch_id' = v_batch::text;
  get diagnostics n = row_count; raise notice 'lodging_occupancies removidos: %', n;

  delete from public.lodging_units      where seed_batch_id = v_batch;
  get diagnostics n = row_count; raise notice 'lodging_units removidos: %', n;

  delete from public.lodging_locations  where seed_batch_id = v_batch;
  get diagnostics n = row_count; raise notice 'lodging_locations removidos: %', n;

  delete from public.participant_event_stages where created_by = v_batch;
  get diagnostics n = row_count; raise notice 'participant_event_stages removidos: %', n;
end $$;

-- Conferência (deve retornar tudo zero após a limpeza):
-- select
--   (select count(*) from meal_consumptions where method='seed_demo') as meals,
--   (select count(*) from lodging_occupancies where metadata->>'seed_batch_id'='00000000-5eed-4000-8000-000000000001') as occ,
--   (select count(*) from lodging_units where seed_batch_id='00000000-5eed-4000-8000-000000000001') as units,
--   (select count(*) from participant_event_stages where created_by='00000000-5eed-4000-8000-000000000001') as pes;
