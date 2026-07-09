-- ============================================================
-- meal_consumptions_unlinked — fecha o gap de migration (drift de schema)
-- ============================================================
-- Esta tabela já existe no banco em produção (é usada pelo scanner de
-- alimentação para QRs que não resolvem a um participante cadastrado —
-- ver src/pages/pwa/alimentacao/AlimentacaoScanPage.tsx,
-- registerMealConsumptionUnlinked) e serviu de modelo explícito para
-- material_deliveries_unlinked (20260708010000_material_delivery_unlinked.sql,
-- ver comentário "Espelha o padrão de meal_consumptions_unlinked"), mas
-- nunca teve o próprio CREATE TABLE registrado em supabase/migrations/ —
-- o schema não era reproduzível a partir do histórico de migrations em
-- um ambiente novo.
--
-- CREATE TABLE IF NOT EXISTS é um no-op em produção (tabela já existe) e
-- fecha o drift para qualquer ambiente reconstruído a partir do zero.
--
-- RLS: a tabela em produção já tem policies próprias (o insert direto do
-- client em AlimentacaoScanPage.tsx só funciona porque elas existem).
-- Não são redeclaradas aqui para não colidir com nomes de policy já
-- criados fora do histórico de migrations — se precisar recriar este
-- ambiente do zero, sincronize as policies de RLS separadamente (ex.:
-- `supabase db diff` contra o projeto vivo) antes de liberar o módulo.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meal_consumptions_unlinked (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code       text NOT NULL,
  meal_window_id uuid NOT NULL REFERENCES public.meal_windows(id) ON DELETE CASCADE,
  method        text NOT NULL DEFAULT 'qr_scan',
  registered_by uuid REFERENCES auth.users(id),
  consumed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meal_window_id, qr_code)
);

CREATE INDEX IF NOT EXISTS idx_meal_consumptions_unlinked_window
  ON public.meal_consumptions_unlinked (meal_window_id);

CREATE INDEX IF NOT EXISTS idx_meal_consumptions_unlinked_consumed_at
  ON public.meal_consumptions_unlinked (consumed_at);
