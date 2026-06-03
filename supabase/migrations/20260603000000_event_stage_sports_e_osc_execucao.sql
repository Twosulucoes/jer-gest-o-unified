-- Vínculo modalidade x etapa/sede + execução (realizado) das metas OSC
-- Origem: Cronograma Oficial JER's/JERPA 2026 (v1.0, 19/05/2026).
--
-- 1) event_stage_sports: tabela que faltava para registrar QUAIS modalidades
--    estão planejadas em cada etapa/sede. Até aqui essa relação só existia
--    derivada (vw_stage_sport_event_summary) a partir de inscrições/partidas.
-- 2) osc_meta_targets: estendida com valor_executado/fonte para guardar o
--    realizado oficial digitado pelo gestor (antes só havia valor_previsto).

-- ============================================================
-- 1) event_stage_sports
-- ============================================================
create table if not exists public.event_stage_sports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  event_stage_id uuid not null references public.event_stages(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete cascade,
  programa text not null default 'jers' check (programa in ('jers','jerpa')),
  is_planned boolean not null default true,
  source text not null default 'cronograma',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  constraint event_stage_sports_uq unique (event_stage_id, sport_id)
);
create index if not exists idx_ess_event on public.event_stage_sports(event_id);
create index if not exists idx_ess_stage on public.event_stage_sports(event_stage_id);
create index if not exists idx_ess_sport on public.event_stage_sports(sport_id);

drop trigger if exists trg_event_stage_sports_updated_at on public.event_stage_sports;
create trigger trg_event_stage_sports_updated_at
  before update on public.event_stage_sports
  for each row execute function public.update_updated_at_column();

alter table public.event_stage_sports enable row level security;

drop policy if exists "event_stage_sports visiveis autenticados" on public.event_stage_sports;
create policy "event_stage_sports visiveis autenticados"
  on public.event_stage_sports for select
  to authenticated using (true);

drop policy if exists "event_stage_sports editaveis admin secretaria" on public.event_stage_sports;
create policy "event_stage_sports editaveis admin secretaria"
  on public.event_stage_sports for all
  using (exists (select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any (array['admin','secretaria','super_admin']::app_role[])))
  with check (exists (select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any (array['admin','secretaria','super_admin']::app_role[])));

-- ============================================================
-- 2) osc_meta_targets: execução (realizado) oficial
-- ============================================================
alter table public.osc_meta_targets
  add column if not exists valor_executado numeric,
  add column if not exists fonte text;

create unique index if not exists osc_meta_targets_uq_stage
  on public.osc_meta_targets (event_id, meta_number, metric_key, event_stage_id)
  where event_stage_id is not null;
create unique index if not exists osc_meta_targets_uq_global
  on public.osc_meta_targets (event_id, meta_number, metric_key)
  where event_stage_id is null;

-- ============================================================
-- 3) Seed dos vínculos modalidade x sede (Cronograma Oficial v1.0)
--    Regionais: modalidades coletivas. Finais (Boa Vista): individuais,
--    com desdobramento JER's/JERPA. Idempotente (on conflict do nothing).
-- ============================================================
insert into public.event_stage_sports (event_id,event_stage_id,sport_id,programa,source,notes) values
('de0cd62b-05b9-4147-9257-9543d61d5739','523c1148-b7ba-408b-87cc-7eddcd398bf2','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','eed3d459-c6d7-478c-b339-8dd9333dd3e8','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e398f9d2-4faa-4e50-bd1d-ab80f935eb9e','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','b3c61dea-3492-4f8a-8f9c-5e5226f1d7c6','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','5c53fa71-c6b6-4a35-b14d-eb4d4891adec','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','014641c9-ee48-4ee8-9556-5f9fc6bdf186','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','58c8ea06-4652-4099-8aed-c05b0838a7d1','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','72aa8663-dca8-46e4-9a10-f134bb5b3acc','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','fda9a42e-3c9a-425a-8a09-1e599468afcd','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','718a60e7-24d0-4ad1-bd18-197660cc43f0','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac','jers','cronograma (ajustado)','Cronograma marca F1; alocado em F2 JERS conforme nome da etapa no BD'),
('de0cd62b-05b9-4147-9257-9543d61d5739','523c1148-b7ba-408b-87cc-7eddcd398bf2','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','eed3d459-c6d7-478c-b339-8dd9333dd3e8','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e398f9d2-4faa-4e50-bd1d-ab80f935eb9e','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','b3c61dea-3492-4f8a-8f9c-5e5226f1d7c6','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','5c53fa71-c6b6-4a35-b14d-eb4d4891adec','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','014641c9-ee48-4ee8-9556-5f9fc6bdf186','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','58c8ea06-4652-4099-8aed-c05b0838a7d1','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','72aa8663-dca8-46e4-9a10-f134bb5b3acc','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','fda9a42e-3c9a-425a-8a09-1e599468afcd','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','718a60e7-24d0-4ad1-bd18-197660cc43f0','4660d7c2-a066-450a-8b23-70425e5ee4de','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e398f9d2-4faa-4e50-bd1d-ab80f935eb9e','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','b3c61dea-3492-4f8a-8f9c-5e5226f1d7c6','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','5c53fa71-c6b6-4a35-b14d-eb4d4891adec','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','014641c9-ee48-4ee8-9556-5f9fc6bdf186','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','58c8ea06-4652-4099-8aed-c05b0838a7d1','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','72aa8663-dca8-46e4-9a10-f134bb5b3acc','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','fda9a42e-3c9a-425a-8a09-1e599468afcd','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','718a60e7-24d0-4ad1-bd18-197660cc43f0','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e17788df-e08f-4031-bb10-f1a57a759f81','b806d4cd-0184-4c0e-96be-20788573c10c','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','fda9a42e-3c9a-425a-8a09-1e599468afcd','9471e34c-8f8d-446a-b625-8b552cd5da3b','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','718a60e7-24d0-4ad1-bd18-197660cc43f0','9471e34c-8f8d-446a-b625-8b552cd5da3b','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e17788df-e08f-4031-bb10-f1a57a759f81','9471e34c-8f8d-446a-b625-8b552cd5da3b','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','7cb1f2f2-11de-414c-b252-cdd5da0dbb6d','aa009bf0-0933-4294-acad-75c870635870','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e17788df-e08f-4031-bb10-f1a57a759f81','f0fcdbd8-1c96-4b29-b780-40643a209356','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e17788df-e08f-4031-bb10-f1a57a759f81','249f1878-5480-418c-a242-44128cba653e','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','f254c254-6289-4e98-86f3-d9d268c32a82','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e440e659-6592-4cb2-8b22-65d4d6a95723','03950e1d-fbcf-4853-8bb9-1a07beac82d8','jerpa','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e17788df-e08f-4031-bb10-f1a57a759f81','b02c8d94-cadf-4b5b-9617-f49cae285329','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','a5309136-5f60-42b7-8dc1-2df37e538fc8','98c3ce0b-67f8-4dec-9200-d20d4b4e66f0','jerpa','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e440e659-6592-4cb2-8b22-65d4d6a95723','105cc7cf-9c19-4856-adf5-5f210345a597','jerpa','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','67691644-91c0-4c36-8c04-dc035f90fa07','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','2ab5c34c-42c4-45ca-9a49-6334bcf97ed6','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','bfbaf85e-b628-4bf4-afe3-e2e55c3010da','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','3355de46-a854-46eb-82d2-95acbdac5d28','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','cfd26923-2693-4dbe-84ee-fb97d507aeab','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e440e659-6592-4cb2-8b22-65d4d6a95723','bf797a25-57b6-40c5-8e89-018d496a7162','jerpa','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','75d38123-7c40-4058-85ac-0288dd6b5917','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e17788df-e08f-4031-bb10-f1a57a759f81','d0b9ca2d-5ab8-4a44-9311-5f0fd9ad1e18','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','a5309136-5f60-42b7-8dc1-2df37e538fc8','cc7f84ad-8830-4fed-9880-d2d3d3a9412e','jerpa','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','524f74d8-bc06-43a7-bbfd-69883d412a66','853d6423-9c8a-40f5-be44-5dab39c80a5f','jers','cronograma',null),
('de0cd62b-05b9-4147-9257-9543d61d5739','e17788df-e08f-4031-bb10-f1a57a759f81','9f6313ef-950d-45e6-9fec-d6ad6cfc24a2','jers','cronograma',null)
on conflict (event_stage_id,sport_id) do nothing;
