-- Drop ambíguo overload de 7 args de link_external_credential.
--
-- Contexto: foi criada (fora do controle de versão das migrations) uma
-- sobrecarga `link_external_credential(uuid, uuid, text, uuid, uuid, boolean, text)`
-- com o argumento adicional `p_idempotency_key`. Como o cliente PostgREST
-- chama a RPC pelos nomes dos parâmetros (6 nomes), o Postgres não consegue
-- escolher entre as duas funções e retorna:
--
--   "Could not choose the best candidate function between
--    public.link_external_credential(... 6 args ...),
--    public.link_external_credential(... 7 args com p_idempotency_key ...)".
--
-- A versão canônica (com 6 argumentos) é a única usada pelo frontend
-- (BulkExternalCredentialImport, CredenciamentoExternoPage e
-- VincularCredencialPage) e é a definida pela migration
-- 20260506400000_credenciamento_c4_is_active_generated.sql. Removemos a
-- sobrecarga de 7 argumentos para eliminar a ambiguidade.

DROP FUNCTION IF EXISTS public.link_external_credential(
  uuid, uuid, text, uuid, uuid, boolean, text
);
