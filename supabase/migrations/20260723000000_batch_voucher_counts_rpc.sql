-- ============================================================
-- Contagem correta de vouchers ativos por lote (RPC agregada)
--
-- Bug corrigido: VouchersPage.tsx contava "ativos / total" por lote
-- com `supabase.from("service_vouchers").select("batch_id, status")
-- .in("batch_id", ...)`, que sofre o limite padrão de 1.000 linhas do
-- PostgREST. Com milhares de vouchers na etapa (ex.: 6.110), a query só
-- enxergava os primeiros 1.000; os lotes cujos vouchers ficavam de fora
-- recebiam `active: 0` no cliente e eram exibidos como "Revogado" mesmo
-- estando 100% ativos no banco. Isso induzia operadores a revogar e
-- reemitir lotes válidos, gerando ainda mais vouchers e agravando o
-- próprio limite — um ciclo vicioso.
--
-- Correção: uma função que faz a agregação no servidor (GROUP BY), sem
-- trafegar linha a linha e, portanto, imune ao teto de 1.000 linhas.
--
-- Segurança: SECURITY INVOKER (padrão) — a RLS de `service_vouchers`
-- continua valendo, então cada usuário conta apenas os vouchers que já
-- podia enxergar (mesmo escopo do query anterior). Nada de novo é
-- exposto.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_batch_voucher_counts(p_batch_ids uuid[])
RETURNS TABLE (batch_id uuid, active bigint, total bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        v.batch_id,
        count(*) FILTER (WHERE v.status = 'active') AS active,
        count(*)                                    AS total
    FROM public.service_vouchers v
    WHERE v.batch_id = ANY(p_batch_ids)
    GROUP BY v.batch_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_batch_voucher_counts(uuid[]) TO authenticated;
