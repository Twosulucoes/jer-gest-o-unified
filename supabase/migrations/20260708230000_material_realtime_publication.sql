-- ============================================================
-- Habilita Realtime (tempo real) nas tabelas de entrega de material
-- ============================================================
-- Todo o código de frontend (MaterialScanPage, MaterialListaPage) já
-- assinava `postgres_changes` nessas tabelas desde os PRs #262/#266/#267,
-- mas as assinaturas nunca recebiam nada: o Supabase Realtime só transmite
-- mudanças de tabelas explicitamente adicionadas à publicação
-- `supabase_realtime` (diferente de Alimentação, que já tinha
-- meal_consumptions/meal_windows/etc. habilitadas desde antes).
--
-- Sem isso, cada aparelho só via os próprios KPIs atualizarem (o estado
-- local mudava na hora do próprio scan) — nenhum aparelho via ao vivo o
-- que os outros operadores estavam registrando.

ALTER PUBLICATION supabase_realtime ADD TABLE public.material_deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_deliveries_unlinked;
