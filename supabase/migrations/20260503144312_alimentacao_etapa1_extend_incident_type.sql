-- Etapa 1 da Auditoria do Módulo de Alimentação
-- Estende o enum meal_incident_type com os motivos de bloqueio que já são
-- usados pelo PWA mas hoje caem em "OTHER" ou são mapeados para "NOT_ELIGIBLE"
-- por falta de valor específico. Sem essa extensão, a trilha de auditoria não
-- distingue entre "sem credencial", "inativo", "não precisa alimentação" e
-- "saiu do evento", o que prejudica a prestação de contas.
--
-- ALTER TYPE ... ADD VALUE é idempotente quando usado com IF NOT EXISTS no
-- PostgreSQL 12+.

ALTER TYPE public.meal_incident_type ADD VALUE IF NOT EXISTS 'NO_CREDENTIAL';
ALTER TYPE public.meal_incident_type ADD VALUE IF NOT EXISTS 'PARTICIPANT_INACTIVE';
ALTER TYPE public.meal_incident_type ADD VALUE IF NOT EXISTS 'NEEDS_MEALS_FALSE';
ALTER TYPE public.meal_incident_type ADD VALUE IF NOT EXISTS 'LEFT_EVENT';
