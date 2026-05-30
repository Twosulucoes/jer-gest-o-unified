-- Upsert seguro para metas previstas (índice único é expressão -> evita onConflict no PostgREST)
create or replace function public.set_osc_meta_target(
  p_event_id uuid,
  p_meta_number smallint,
  p_metric_key text,
  p_valor_previsto numeric,
  p_event_stage_id uuid default null,
  p_unidade text default null
) returns public.osc_meta_targets
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.osc_meta_targets;
begin
  update public.osc_meta_targets
     set valor_previsto = p_valor_previsto,
         unidade = coalesce(p_unidade, unidade),
         updated_at = now(),
         updated_by = auth.uid()
   where event_id = p_event_id
     and meta_number = p_meta_number
     and metric_key = p_metric_key
     and coalesce(event_stage_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_event_stage_id, '00000000-0000-0000-0000-000000000000'::uuid)
  returning * into v_row;

  if not found then
    insert into public.osc_meta_targets
      (event_id, meta_number, metric_key, event_stage_id, valor_previsto, unidade, created_by, updated_by)
    values
      (p_event_id, p_meta_number, p_metric_key, p_event_stage_id, p_valor_previsto, p_unidade, auth.uid(), auth.uid())
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_osc_meta_target(uuid, smallint, text, numeric, uuid, text) to authenticated;
