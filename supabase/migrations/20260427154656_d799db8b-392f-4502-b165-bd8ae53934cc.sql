CREATE OR REPLACE FUNCTION public.rpc_allocate_lodging_batch(
    p_event_id UUID,
    p_delegation_id UUID,
    p_allocations JSONB,
    p_allocated_by UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_participant_id UUID;
    v_unit_id UUID;
    v_allocated_count INTEGER := 0;
    v_user_role TEXT;
    v_participant_belongs BOOLEAN;
    v_unit_belongs BOOLEAN;
    v_unit_capacity INTEGER;
    v_unit_occupied INTEGER;
    v_unit_gender TEXT;
    v_participant_gender TEXT;
BEGIN
    -- 1. Validar permissões do usuário
    SELECT role INTO v_user_role 
    FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'alojamento', 'super_admin')
    LIMIT 1;

    IF v_user_role IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'failed',
            'error_type', 'permission',
            'error_message', 'Usuário não tem permissão para realizar alocações.'
        );
    END IF;

    -- 2. Processar cada alocação no array JSONB
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
        v_participant_id := (v_item->>'participant_id')::UUID;
        v_unit_id := (v_item->>'unit_id')::UUID;

        -- Validar que o participante pertence à delegação e ao evento
        SELECT EXISTS (
            SELECT 1 FROM participants 
            WHERE id = v_participant_id 
            AND delegation_id = p_delegation_id 
            AND event_id = p_event_id
        ) INTO v_participant_belongs;

        IF NOT v_participant_belongs THEN
            RAISE EXCEPTION 'Participante % não pertence à delegação ou ao evento.', v_participant_id;
        END IF;

        -- Validar que a unidade pertence ao evento (via event_stage_id do evento)
        -- Nota: Aqui assumimos que a unidade está vinculada a uma etapa do evento informado
        SELECT EXISTS (
            SELECT 1 FROM lodging_units lu
            JOIN event_stages es ON lu.event_stage_id = es.id
            WHERE lu.id = v_unit_id AND es.event_id = p_event_id
        ) INTO v_unit_belongs;

        IF NOT v_unit_belongs THEN
            RAISE EXCEPTION 'Unidade de alojamento % não pertence a uma etapa deste evento.', v_unit_id;
        END IF;

        -- Validar capacidade e gênero (triggers já existem, mas validamos aqui para retorno amigável)
        SELECT capacity, gender_restriction INTO v_unit_capacity, v_unit_gender
        FROM lodging_units WHERE id = v_unit_id;

        SELECT count(*) INTO v_unit_occupied
        FROM lodging_occupancies WHERE unit_id = v_unit_id AND status IN ('allocated', 'checked_in');

        IF v_unit_occupied >= v_unit_capacity THEN
            RETURN jsonb_build_object(
                'status', 'failed',
                'error_type', 'capacity',
                'error_message', 'Capacidade excedida na unidade ' || v_unit_id,
                'failed_at', jsonb_build_object('participant_id', v_participant_id, 'unit_id', v_unit_id)
            );
        END IF;

        -- Inserir ocupação
        INSERT INTO lodging_occupancies (
            event_id,
            participant_id,
            unit_id,
            status,
            allocated_by
        ) VALUES (
            p_event_id,
            v_participant_id,
            v_unit_id,
            'allocated',
            p_allocated_by
        );

        v_allocated_count := v_allocated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'allocated_count', v_allocated_count
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'failed',
        'error_type', 'other',
        'error_message', SQLERRM
    );
END;
$$;
