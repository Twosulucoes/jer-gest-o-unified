-- 1. Backfill: credenciais 'active' sem is_active definido → marcar como ativas
UPDATE public.participant_credentials
SET is_active = true
WHERE status = 'active' AND is_active IS NULL;

-- 2. Backfill: credenciais revogadas/reemitidas → marcar como inativas
UPDATE public.participant_credentials
SET is_active = false
WHERE status IN ('reissued', 'revoked', 'cancelled', 'expired') AND is_active IS NULL;

-- 3. Garantir default e NOT NULL para prevenir o bug no futuro
ALTER TABLE public.participant_credentials
  ALTER COLUMN is_active SET DEFAULT false;

UPDATE public.participant_credentials SET is_active = false WHERE is_active IS NULL;

ALTER TABLE public.participant_credentials
  ALTER COLUMN is_active SET NOT NULL;

-- 4. Trigger: ao inserir/atualizar uma credencial 'active', desativar as outras do mesmo participante
CREATE OR REPLACE FUNCTION public.enforce_single_active_credential()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true AND NEW.status = 'active' THEN
    UPDATE public.participant_credentials
    SET is_active = false,
        status = CASE WHEN status = 'active' THEN 'reissued' ELSE status END,
        revoked_at = COALESCE(revoked_at, now())
    WHERE participant_id = NEW.participant_id
      AND event_id = NEW.event_id
      AND id <> NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_active_credential ON public.participant_credentials;
CREATE TRIGGER trg_enforce_single_active_credential
AFTER INSERT OR UPDATE OF is_active, status ON public.participant_credentials
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_active_credential();

-- 5. Backfill participants.status: quem tem credencial ativa mas status != 'credentialed'
UPDATE public.participants p
SET status = 'credentialed',
    credentialed_at = COALESCE(p.credentialed_at, pc.activated_at, pc.issued_at, now())
FROM public.participant_credentials pc
WHERE pc.participant_id = p.id
  AND pc.is_active = true
  AND pc.status = 'active'
  AND p.status <> 'credentialed';