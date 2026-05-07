-- =============================================================================
-- Auditoria completa do módulo credenciamento — v2
-- Consolida: schema (guardian_relationship), políticas RLS (participant_credentials,
-- credential_scans, external_credentials, participants, people), CHECK constraint
-- em external_credentials.cancel_reason, e índice parcial em external_credentials.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. SCHEMA: people.guardian_relationship
-- Corrige bug crítico onde o campo "Vínculo" do responsável era gravado em
-- coach_name (sobrescrevendo o nome do treinador e zerando coach_phone).
-- ---------------------------------------------------------------------------
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS guardian_relationship text;

-- ---------------------------------------------------------------------------
-- 2. CHECK: external_credentials.cancel_reason
-- Alinha o banco com o enum implícito do front-end.
-- cancel_reason IS NULL é permitido (campo opcional).
-- ---------------------------------------------------------------------------
ALTER TABLE public.external_credentials
  DROP CONSTRAINT IF EXISTS external_credentials_cancel_reason_check;

ALTER TABLE public.external_credentials
  ADD CONSTRAINT external_credentials_cancel_reason_check
  CHECK (
    cancel_reason IS NULL OR
    cancel_reason = ANY(ARRAY[
      'extraviada', 'danificada', 'erro_cadastro', 'duplicidade', 'outro'
    ])
  );

-- ---------------------------------------------------------------------------
-- 3. ÍNDICE PARCIAL: external_credentials (event_id, credential_code)
-- O índice total bloqueava reutilização de cartão físico após cancelamento.
-- A unicidade continua garantida entre credenciais ATIVAS; cartões cancelados
-- podem ser revinculados a outro participante no mesmo evento.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_external_credentials_event_code;

CREATE UNIQUE INDEX uq_external_credentials_event_code
  ON public.external_credentials(event_id, credential_code)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 4. RLS: participant_credentials — adicionar alojamento e coordenador_modalidade
-- Sem isso, lookup por QR retorna zero rows para esses perfis (parecem inválidos).
-- ---------------------------------------------------------------------------
CREATE POLICY "Alojamento can read participant_credentials"
  ON public.participant_credentials
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alojamento'::app_role));

-- Coordenador de modalidade: escopado pelas modalidades vinculadas em user_sport_links.
CREATE POLICY "Coordenador modalidade can read scoped participant_credentials"
  ON public.participant_credentials
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'coordenador_modalidade'::app_role)
    AND EXISTS (
      SELECT 1
      FROM participants p
      JOIN participant_sport_events pse ON pse.participant_id = p.id
      JOIN sport_events se               ON se.id = pse.sport_event_id
      JOIN user_sport_links usl          ON usl.sport_id  = se.sport_id
                                        AND usl.event_id  = se.event_id
                                        AND usl.user_id   = auth.uid()
      WHERE p.id = participant_credentials.participant_id
    )
  );

-- ---------------------------------------------------------------------------
-- 5. RLS: credential_scans — adicionar alojamento e coordenador_modalidade
-- Sem INSERT: operadores não registram passagem. Sem SELECT: histórico vazio.
-- alimentacao e transporte passam a ver todos os scans do evento (não só os próprios)
-- para conferência entre turnos.
-- ---------------------------------------------------------------------------

-- alojamento
CREATE POLICY "Alojamento can insert own scans"
  ON public.credential_scans
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'alojamento'::app_role)
    AND scanned_by = auth.uid()
  );

CREATE POLICY "Alojamento can read credential_scans"
  ON public.credential_scans
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alojamento'::app_role));

-- coordenador_modalidade
CREATE POLICY "Coordenacao modalidade can insert own scans"
  ON public.credential_scans
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'coordenador_modalidade'::app_role)
    AND scanned_by = auth.uid()
  );

CREATE POLICY "Coordenacao modalidade can read credential_scans"
  ON public.credential_scans
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenador_modalidade'::app_role));

-- Ampliar alimentacao e transporte para ver scans de todos os operadores
-- (não só os próprios) — necessário para conferência entre turnos.
DROP POLICY IF EXISTS "Alimentacao can read own scans" ON public.credential_scans;
DROP POLICY IF EXISTS "Transporte can read own scans"  ON public.credential_scans;

CREATE POLICY "Alimentacao can read credential_scans"
  ON public.credential_scans
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'alimentacao'::app_role));

CREATE POLICY "Transporte can read credential_scans"
  ON public.credential_scans
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'transporte'::app_role));

-- ---------------------------------------------------------------------------
-- 6. RLS: external_credentials — coordenador_modalidade escopado
-- Policy ampla incluía coordenador_modalidade sem filtro de modalidade,
-- expondo credenciais externas de outros esportes.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "external_credentials_select" ON public.external_credentials;

-- Recria sem coordenador_modalidade (este ganha policy própria escopada abaixo)
DROP POLICY IF EXISTS "external_credentials_select" ON public.external_credentials;
CREATE POLICY "external_credentials_select"
  ON public.external_credentials
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'secretaria'::app_role)
    OR has_role(auth.uid(), 'coordenacao_tecnica'::app_role)
    OR has_role(auth.uid(), 'transporte'::app_role)
    OR has_role(auth.uid(), 'alimentacao'::app_role)
    OR has_role(auth.uid(), 'alojamento'::app_role)
  );

CREATE POLICY "Coordenador modalidade can read scoped external_credentials"
  ON public.external_credentials
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'coordenador_modalidade'::app_role)
    AND EXISTS (
      SELECT 1
      FROM participants p
      JOIN participant_sport_events pse ON pse.participant_id = p.id
      JOIN sport_events se               ON se.id = pse.sport_event_id
      JOIN user_sport_links usl          ON usl.sport_id  = se.sport_id
                                        AND usl.event_id  = se.event_id
                                        AND usl.user_id   = auth.uid()
      WHERE p.id = external_credentials.participant_id
    )
  );

-- ---------------------------------------------------------------------------
-- 7. RLS: participants — remover políticas amplas que anulam as escopadas
-- "Coordinators can read participants" concedia visão irrestrita a todos os
-- participantes do evento; as policies escopadas (Coord modalidade read /
-- Coordenador modalidade can read scoped participants) faziam join com
-- user_sport_links mas eram ignoradas pela policy ampla.
-- "Delegacao can read participants" idem para o papel delegacao.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Coordinators can read participants"  ON public.participants;
DROP POLICY IF EXISTS "Delegacao can read participants"     ON public.participants;

-- ---------------------------------------------------------------------------
-- 8. RLS: people — substituir policy ampla de delegacao por versão escopada
-- "Delegacao can read people" deixava conta de delegação ver CPF/telefone de
-- pessoas de outras delegações. Substitui por versão filtrada pela própria
-- delegation_id (via JOIN em participants).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Delegacao can read people" ON public.people;

CREATE POLICY "Delegacao can read own delegation people"
  ON public.people
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'delegacao'::app_role)
    AND EXISTS (
      SELECT 1
      FROM participants p
      WHERE p.person_id      = people.id
        AND p.delegation_id  = get_user_delegation_id(auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 9. PERMISSÕES: novas funções/índices não precisam de GRANT adicional
-- pois operam via SECURITY DEFINER ou são acessadas por usuários autenticados
-- através das políticas RLS acima.
-- ---------------------------------------------------------------------------
-- credential_audit_log: INSERT protegido por ausência de policy (default-deny).
-- tg_audit_external_credentials e tg_audit_participant_credentials são
-- SECURITY DEFINER e ignoram RLS — único caminho intencional de escrita.
-- Nenhuma policy de INSERT é necessária; a tabela permanece protegida.
