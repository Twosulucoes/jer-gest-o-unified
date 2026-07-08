-- ============================================================
-- Papel 'material': leitura dos dados necessários para resolver o crachá
-- ============================================================
-- A migration 20260705010001_protocolo_entrega_material.sql concedeu ao papel
-- 'material' acesso a material_kits e material_deliveries, mas NÃO às tabelas
-- que o fluxo de scan precisa ler para associar a credencial a um NOME:
--   participants, people, participant_credentials, external_credentials.
--
-- Consequência em campo: o crachá "bipa", mas resolveQrCredential/validate-qr
-- não conseguem trazer o full_name (RLS barra o join até people), então a tela
-- mostra "sem nome" / "Crachá não reconhecido" e a busca manual não retorna
-- ninguém. Os dados estão íntegros — falta apenas a permissão de leitura.
--
-- Esta migration espelha exatamente as políticas de SELECT que 'transporte' e
-- 'alojamento' já possuem nessas tabelas, apenas para o papel 'material'.
-- (Somente leitura; nenhuma escrita é concedida.)

-- participants
CREATE POLICY "Material can read participants" ON public.participants
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'material'));

-- people (onde está o full_name exibido no scan)
CREATE POLICY "Material can read people" ON public.people
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'material'));

-- participant_credentials (resolução do QR nativo)
CREATE POLICY "Material can read participant_credentials" ON public.participant_credentials
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'material'));

-- external_credentials (resolução do QR externo)
CREATE POLICY "Material can read external_credentials" ON public.external_credentials
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'material'));
