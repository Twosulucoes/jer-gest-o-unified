-- ============================================================
-- Vouchers P3 — pg_cron a cada minuto
-- (auditoria etapa Hqy0B-p3)
-- ============================================================
-- A migration 20260506063000 já agendou mark_expired_vouchers a
-- cada 15 minutos. Em pico de evento isso pode atrasar até 14 min
-- a transição active→expired na UI (a RPC redeem_voucher já trata
-- on-the-fly, mas a listagem admin reflete tarde).
--
-- Aumenta para 1 minuto. Query é trivial (UPDATE WHERE valid_until
-- < now() AND status='active') com índice em status, custo
-- desprezível. Idempotente (DO $$ … cron.unschedule + schedule).
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
       FROM cron.job
      WHERE jobname = 'jer_mark_expired_vouchers';

    PERFORM cron.schedule(
      'jer_mark_expired_vouchers',
      '* * * * *',
      $cron$ SELECT public.mark_expired_vouchers(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron indisponível — mark_expired_vouchers deve ser chamado manualmente ou pelas RPCs in-line.';
  END IF;
END $$;
