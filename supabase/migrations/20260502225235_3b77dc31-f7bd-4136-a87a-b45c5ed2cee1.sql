-- Função para validar a alteração de gênero na unidade
CREATE OR REPLACE FUNCTION public.validate_lodging_unit_gender_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a restrição mudou e não é 'mixed'
    IF (TG_OP = 'UPDATE') AND NEW.gender_restriction IS NOT NULL AND NEW.gender_restriction != 'mixed' AND 
       (OLD.gender_restriction IS NULL OR OLD.gender_restriction != NEW.gender_restriction) THEN
        
        -- Verificar se existem ocupantes com gênero diferente
        IF EXISTS (
            SELECT 1 
            FROM public.lodging_occupancies o
            JOIN public.participants pa ON pa.id = o.participant_id
            JOIN public.people pe ON pe.id = pa.person_id
            WHERE o.unit_id = NEW.id 
              AND o.status IN ('allocated', 'checked_in')
              AND pe.gender != NEW.gender_restriction
        ) THEN
            RAISE EXCEPTION 'Não é possível alterar a restrição para %, pois existem ocupantes de gênero incompatível nesta unidade.', 
                CASE WHEN NEW.gender_restriction = 'male' THEN 'Masculino' ELSE 'Feminino' END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gatilho para validar a alteração da unidade
DROP TRIGGER IF EXISTS tr_validate_lodging_unit_gender_change ON public.lodging_units;
CREATE TRIGGER tr_validate_lodging_unit_gender_change
BEFORE UPDATE OF gender_restriction ON public.lodging_units
FOR EACH ROW
EXECUTE FUNCTION public.validate_lodging_unit_gender_change();
