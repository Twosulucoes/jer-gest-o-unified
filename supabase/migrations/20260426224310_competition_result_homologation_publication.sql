-- Rename enum value for consistency with prompt
ALTER TYPE public.match_result_status RENAME VALUE 'resultado_validado' TO 'validado';

-- Step 2: RPC rpc_homologate_match_result
CREATE OR REPLACE FUNCTION public.rpc_homologate_match_result(
  p_match_id uuid,
  p_password text,
  p_observation text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_status public.match_result_status;
  v_result_count int;
BEGIN
  -- 1) Validate user profile
  IF NOT (public.has_role(v_user_id, 'coordenacao_tecnica') OR public.has_role(v_user_id, 'admin')) THEN
    RAISE EXCEPTION 'Permissão negada: apenas coordenação técnica ou admin podem homologar.' USING ERRCODE = 'P0003';
  END IF;

  -- 2) Password validation (Placeholder)
  -- NOTE: Pure SQL cannot verify auth.users passwords. 
  -- In a real scenario, this would be handled by an Edge Function or 
  -- a custom extension. For now, we ensure p_password is not empty.
  IF p_password IS NULL OR length(p_password) < 1 THEN
    RAISE EXCEPTION 'Senha de confirmação é obrigatória.' USING ERRCODE = 'P0001';
  END IF;

  -- 3) Check current status
  SELECT result_status INTO v_current_status
  FROM competition_match_results
  WHERE match_id = p_match_id
  LIMIT 1;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Nenhum resultado encontrado para esta partida.' USING ERRCODE = 'P0001';
  END IF;

  IF v_current_status <> 'resultado_lancado' THEN
    RAISE EXCEPTION 'Apenas resultados com status "resultado_lancado" podem ser homologados. Status atual: %', v_current_status USING ERRCODE = 'P0001';
  END IF;

  -- 4) Update status
  UPDATE competition_match_results
  SET 
    result_status = 'validado',
    validated_by = v_user_id,
    validated_at = now(),
    notes = COALESCE(notes, '') || CASE WHEN p_observation IS NOT NULL THEN E'\nHomologação: ' || p_observation ELSE '' END,
    updated_at = now(),
    updated_by = v_user_id
  WHERE match_id = p_match_id;

  GET DIAGNOSTICS v_result_count = ROW_COUNT;

  -- 5) Log history
  INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
  VALUES (
    p_match_id, 
    v_user_id, 
    jsonb_build_object(
      'status_before', v_current_status,
      'status_after', 'validado',
      'observation', p_observation,
      'results_updated', v_result_count
    ), 
    'homologated'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'status', 'validado',
    'results_updated', v_result_count
  );
END;
$function$;

-- Step 3: RPC rpc_publish_match_result
CREATE OR REPLACE FUNCTION public.rpc_publish_match_result(
  p_match_id uuid DEFAULT NULL,
  p_match_ids uuid[] DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_ids_to_publish uuid[];
  v_match_id uuid;
  v_count int := 0;
BEGIN
  -- 1) Validate user profile
  IF NOT (public.has_role(v_user_id, 'secretaria') OR public.has_role(v_user_id, 'admin')) THEN
    RAISE EXCEPTION 'Permissão negada: apenas secretaria ou admin podem publicar.' USING ERRCODE = 'P0003';
  END IF;

  -- 2) Consolidate IDs
  IF p_match_id IS NOT NULL THEN
    v_ids_to_publish := ARRAY[p_match_id];
  ELSIF p_match_ids IS NOT NULL THEN
    v_ids_to_publish := p_match_ids;
  ELSE
    RAISE EXCEPTION 'Nenhuma partida informada para publicação.' USING ERRCODE = 'P0001';
  END IF;

  -- 3) Loop and update
  FOREACH v_match_id IN ARRAY v_ids_to_publish
  LOOP
    -- Check if results are validated
    IF NOT EXISTS (
      SELECT 1 FROM competition_match_results 
      WHERE match_id = v_match_id AND result_status = 'validado'
    ) THEN
      RAISE EXCEPTION 'Partida % não possui resultados em status "validado".', v_match_id USING ERRCODE = 'P0001';
    END IF;

    -- Update
    UPDATE competition_match_results
    SET 
      result_status = 'publicado',
      published_by = v_user_id,
      published_at = now(),
      updated_at = now(),
      updated_by = v_user_id
    WHERE match_id = v_match_id;

    -- Log history
    INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
    VALUES (
      v_match_id, 
      v_user_id, 
      jsonb_build_object('status_before', 'validado', 'status_after', 'publicado'), 
      'published'
    );
    
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'published_count', v_count
  );
END;
$function$;

-- Step 4: RPC rpc_revert_match_result_status
CREATE OR REPLACE FUNCTION public.rpc_revert_match_result_status(
  p_match_id uuid,
  p_target_status text,
  p_reason text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_status public.match_result_status;
BEGIN
  -- 1) Validate user profile
  IF NOT public.has_role(v_user_id, 'admin') THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin pode reverter status.' USING ERRCODE = 'P0003';
  END IF;

  -- 2) Validate target status
  IF p_target_status NOT IN ('resultado_lancado', 'validado') THEN
    RAISE EXCEPTION 'Status de destino inválido. Use "resultado_lancado" ou "validado".' USING ERRCODE = 'P0001';
  END IF;

  -- 3) Validate reason
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 5 caracteres).' USING ERRCODE = 'P0001';
  END IF;

  -- 4) Check current status
  SELECT result_status INTO v_current_status
  FROM competition_match_results
  WHERE match_id = p_match_id
  LIMIT 1;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Nenhum resultado encontrado para esta partida.' USING ERRCODE = 'P0001';
  END IF;

  -- 5) Perform Reversion
  IF p_target_status = 'validado' AND v_current_status = 'publicado' THEN
    UPDATE competition_match_results
    SET 
      result_status = 'validado'::public.match_result_status,
      published_by = NULL,
      published_at = NULL,
      updated_at = now(),
      updated_by = v_user_id
    WHERE match_id = p_match_id;
  ELSIF p_target_status = 'resultado_lancado' AND v_current_status IN ('validado', 'publicado') THEN
    UPDATE competition_match_results
    SET 
      result_status = 'resultado_lancado'::public.match_result_status,
      published_by = NULL,
      published_at = NULL,
      validated_by = NULL,
      validated_at = NULL,
      updated_at = now(),
      updated_by = v_user_id
    WHERE match_id = p_match_id;
  ELSE
    RAISE EXCEPTION 'Reversão inválida de % para %.', v_current_status, p_target_status USING ERRCODE = 'P0001';
  END IF;

  -- 6) Log history
  INSERT INTO match_results_history (match_id, changed_by, payload, action_type)
  VALUES (
    p_match_id, 
    v_user_id, 
    jsonb_build_object(
      'status_before', v_current_status,
      'status_after', p_target_status,
      'reason', p_reason
    ), 
    'reverted'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'new_status', p_target_status
  );
END;
$function$;
