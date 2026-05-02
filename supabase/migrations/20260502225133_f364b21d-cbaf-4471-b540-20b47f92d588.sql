-- Função para validar a compatibilidade de gênero no alojamento
CREATE OR REPLACE FUNCTION public.validate_lodging_occupancy_gender()
RETURNS TRIGGER AS $$
DECLARE
    v_participant_gender TEXT;
    v_unit_gender_restriction TEXT;
BEGIN
    -- Obter o gênero do participante
    SELECT pe.gender INTO v_participant_gender
    FROM public.participants pa
    JOIN public.people pe ON pe.id = pa.person_id
    WHERE pa.id = NEW.participant_id;

    -- Obter a restrição de gênero da unidade
    SELECT gender_restriction INTO v_unit_gender_restriction
    FROM public.lodging_units
    WHERE id = NEW.unit_id;

    -- Se ambos existirem e houver restrição (diferente de 'mixed' ou nulo)
    IF v_participant_gender IS NOT NULL AND v_unit_gender_restriction IS NOT NULL AND v_unit_gender_restriction != 'mixed' THEN
        IF v_participant_gender != v_unit_gender_restriction THEN
            RAISE EXCEPTION 'Gênero incompatível: O participante (%) não pode ser alocado em uma unidade restrita para o gênero %.', 
                v_participant_gender, v_unit_gender_restriction;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gatilho para validar a alocação
DROP TRIGGER IF EXISTS tr_validate_lodging_occupancy_gender ON public.lodging_occupancies;
CREATE TRIGGER tr_validate_lodging_occupancy_gender
BEFORE INSERT OR UPDATE OF participant_id, unit_id ON public.lodging_occupancies
FOR EACH ROW
EXECUTE FUNCTION public.validate_lodging_occupancy_gender();
