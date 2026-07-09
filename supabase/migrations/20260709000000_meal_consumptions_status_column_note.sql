-- ============================================================
-- Documenta o estado real da coluna meal_consumptions.status
-- ============================================================
-- 20260513000000_alimentacao_add_status_to_meal_consumptions.sql criou
-- status ('active'/'revoked') e um índice único parcial (WHERE
-- status='active') especificamente "para suportar estornos" via soft
-- delete. Na prática, reverse_meal_consumption() (20260506063000) faz
-- DELETE físico da linha — nunca UPDATE status='revoked'. Isso não é um
-- bug de contagem hoje (a linha excluída já sai de qualquer count/soma),
-- mas quer dizer que 'revoked' nunca aparece de fato: nenhuma query de
-- leitura no app (scan da PWA, relatórios, views vw_consumo_*) filtra por
-- status porque não precisa.
--
-- Decisão (auditoria de KPIs de alimentação): manter o comportamento
-- atual de DELETE físico — trocar para soft-revoke exigiria adicionar
-- `WHERE status = 'active'` em cada leitura de meal_consumptions espalhada
-- pelo app e pelas views de relatório (~20 pontos), risco desproporcional
-- ao ganho para um sistema em produção. Documentando aqui para quem for
-- mexer no fluxo de estorno não presumir que 'revoked' está em uso.
-- ============================================================

COMMENT ON COLUMN public.meal_consumptions.status IS
  'Reservado para soft-revoke (active/revoked) — na prática não usado: reverse_meal_consumption() faz DELETE físico da linha, nunca UPDATE status=''revoked''. Todo consumo existente na tabela está, por construção, com status=''active''. Se algum fluxo futuro passar a fazer soft-revoke, toda leitura de meal_consumptions (app + views vw_consumo_*) precisa ganhar WHERE status=''active''.';
