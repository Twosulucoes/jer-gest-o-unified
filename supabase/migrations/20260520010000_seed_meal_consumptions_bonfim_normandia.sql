-- Carga retroativa de consumos de alimentação
-- Etapas: Bonfim / Cantá (841 participantes) e Normandia (559 participantes)
--
-- Distribuição de presença por tipo de refeição/dia:
--   D1 chegada: café 65%, almoço 68%, janta 78%
--   D2–D4 normais: café/almoço 95%, lanche 90%, janta 93%
--   Último dia Bonfim (D5): café 87%
--   Último dia Normandia (D5): café 87%, almoço/lanche 80%, janta 55%
--   Saída final Normandia (D6): café 72%, almoço 65%
--
-- Participantes divididos deterministicamente por md5(participant_id):
--   Grupo A (primeiros 60%): escola principal (Aldébaro / Mariano Vieira)
--   Grupo B (últimos 40%): escola secundária (Maciel Ribeiro / Castro Alves)
--
-- Janelas excluídas:
--   00e68088 → janela "Teste"
--   8d7b839e → Janta D1 Bonfim duplicada (usar f29340b2)
--   a1b9cc36 → Café D6 Normandia duplicado (0 consumos)
--   5040cd7b → tipo=Lanche com label de Café (inconsistente)
--   ef0e2b05 → Almoço D3 Normandia Mariano Vieira com horário inválido
--              (usar 2cb71668; excluir quem já consta em ef0e2b05)

WITH
window_config(window_id, load_pct, location_group, stage_id, exclude_also) AS (VALUES
  -- ── BONFIM (014641c9-ee48-4ee8-9556-5f9fc6bdf186) ──────────────────────
  -- D1 14/05 - chegada
  ('37671466-c8cd-4064-8c03-071023da1804'::uuid,0.65::float,'all','014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('f844ad04-acec-4db6-b0b6-5f1dac4dbb5f'::uuid,0.68::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('0e500125-380e-461d-bade-1639190875b6'::uuid,0.68::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('f29340b2-d0b3-4edf-a55a-1faef5e32481'::uuid,0.78::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('d0843320-6e26-4021-9339-e773867a5270'::uuid,0.78::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  -- D2 15/05
  ('62f9a0f6-beea-42e9-bd82-77b241016ea4'::uuid,0.95::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('56367f15-b8b3-4cd0-b4df-03ddcded5ae1'::uuid,0.95::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('50c2433f-22c2-487d-b581-4d8a020f2728'::uuid,0.95::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('e458cd93-4c8a-4eb4-933e-4aac73fcaf30'::uuid,0.95::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('7f06eea0-3ac2-4d0c-aa94-fc908cb64f4c'::uuid,0.90::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('4c0dcbdf-6a4e-4761-9c49-120cf3e58646'::uuid,0.90::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('90fd21e3-7383-4301-9486-5aae62d4c1e0'::uuid,0.93::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('8235acc6-3c41-4c20-b456-9db56b75755c'::uuid,0.93::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  -- D3 16/05
  ('91e15e71-642b-4826-8bd1-553d419958d3'::uuid,0.95::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('0de89250-5dbf-4c18-a9e8-7e161d734570'::uuid,0.95::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('9143e0e1-4ec4-46fc-8969-f5ce8573889a'::uuid,0.95::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('d975d409-0b92-4e3f-bc2d-cf200832dcab'::uuid,0.95::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('c4c1db49-0b51-40cc-aa01-0908d6858393'::uuid,0.90::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('fb2c0b69-cf89-43da-9329-372f833b3c7f'::uuid,0.90::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('9c41f6de-6adc-434b-a903-db101a05ecc8'::uuid,0.93::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('b77f2cc5-6874-48b9-acdc-96cb1be567ae'::uuid,0.93::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  -- D4 17/05
  ('ea93b2f6-1e68-4cca-895b-929835d4df19'::uuid,0.95::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('8aefe648-d1af-4b87-840d-09960de75009'::uuid,0.95::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('1d0cc194-3185-42dc-836b-d1ed7e14aee0'::uuid,0.95::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('8a05ca25-ba46-4e28-8bae-c9e3e8d6a8b2'::uuid,0.95::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('533a997f-cabd-43d9-92fb-5c09313fa180'::uuid,0.93::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  ('20014d6e-8b39-4c35-9081-3a2a544330cf'::uuid,0.93::float,'B',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),
  -- D5 18/05 - saída (só café, grupo A)
  ('f93609e9-42cc-4f41-9f45-cc1006b10cda'::uuid,0.87::float,'A',  '014641c9-ee48-4ee8-9556-5f9fc6bdf186'::uuid,NULL::uuid),

  -- ── NORMANDIA (58c8ea06-4652-4099-8aed-c05b0838a7d1) ────────────────────
  -- D1 14/05 - chegada (sem café; almoço e janta parciais)
  ('768a5f1a-f6ad-4c74-b8ba-8ac0637a7168'::uuid,0.68::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('d4ded947-9c7d-4016-95ed-a3f6399049ae'::uuid,0.68::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('6e6165ae-d2e4-41a0-bb34-05465023e22d'::uuid,0.78::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  -- D2 15/05
  ('3271782b-6205-473f-a668-a56b053eaf53'::uuid,0.95::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('12efd343-f993-4c0f-8f1b-e025bccaa3e7'::uuid,0.95::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('b127635e-d98a-454b-b030-c971e76f3bfb'::uuid,0.95::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('0848a8d5-2a18-4b5c-bfe9-a18a6f134e2a'::uuid,0.95::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('c4a51197-d1fd-441c-8aaf-70f42efa4c19'::uuid,0.90::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('e2fcc362-d481-49f2-ab72-c901f22420f5'::uuid,0.90::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('6117e645-edbe-45b0-bf31-aba72a0992fa'::uuid,0.93::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('c5690a5b-15cc-44d4-9e18-1f319c9bcdcd'::uuid,0.93::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  -- D3 16/05
  ('fde7460b-ec21-494b-8f05-01543a1fc4f0'::uuid,0.95::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('65d9e7e3-e16b-4dac-bb17-91f099e58e1a'::uuid,0.95::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  -- 2cb71668 = almoço D3 Mariano Vieira real; excluir quem já consta em ef0e2b05
  ('2cb71668-fa8d-4152-9b6b-190015123971'::uuid,0.95::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,'ef0e2b05-e626-44f0-b51b-2940465d9cd9'::uuid),
  ('c92c41c2-c55f-42dd-93b3-ca671a44050e'::uuid,0.95::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('fa3fee86-cacf-4ed6-8840-11af550634dd'::uuid,0.90::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('d60b500b-4017-49d5-a4b3-dda4b66a34aa'::uuid,0.90::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('674e098d-af5d-4413-a283-f31dbe5d4f2c'::uuid,0.93::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('7a1f9474-9ccc-4126-89b1-3b0d5da05afe'::uuid,0.93::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  -- D4 17/05
  ('110a50e0-f86d-4a8b-8c8d-a061f05b8760'::uuid,0.95::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('0989c257-7681-47b3-a3ec-6276c0bcd172'::uuid,0.95::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('3cf2e67d-c57e-4ab9-a98d-acce1c13e92b'::uuid,0.95::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('f820dfe6-9678-47dc-bc88-e0c3fd0449fa'::uuid,0.90::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('56bc44e7-0293-4034-870c-7cae52894912'::uuid,0.90::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('4dec2bfb-6e5e-469f-bec4-4a801fc909af'::uuid,0.93::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('e7b21f4e-ecc4-46f5-9c2e-4d90c8ebbe8e'::uuid,0.93::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  -- D5 18/05 - saída
  ('40e91e9d-8ef1-4806-9ff6-e57eb7127c63'::uuid,0.87::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('6fdb03f5-47ed-47a5-bfa1-6a3d29a59935'::uuid,0.87::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('85229592-e759-4f5d-8898-ac4ee20095fa'::uuid,0.80::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('00eb7b6c-521f-46bb-a8c4-f02aaf73718d'::uuid,0.80::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('b5843974-34c0-491f-bfa4-ba765df8add6'::uuid,0.80::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('2f2ada2f-e4c9-47e8-b5a9-9343ab3cce7e'::uuid,0.80::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('275ddd65-e7b1-4f6e-8c26-610296a7f754'::uuid,0.55::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('bbb5e2f7-eda0-4a3b-8f76-bf9689c64db8'::uuid,0.55::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  -- D6 19/05 - saída final
  ('df309457-a366-44f9-93d0-9e1d7669a0ba'::uuid,0.72::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('c4777f5d-7290-4375-a60f-143c794249f5'::uuid,0.72::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('2e487a76-1074-49ca-9a2d-a8c4fa8ca9d6'::uuid,0.65::float,'A',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid),
  ('0a052205-bd79-4b51-a170-de9122763940'::uuid,0.65::float,'B',  '58c8ea06-4652-4099-8aed-c05b0838a7d1'::uuid,NULL::uuid)
),

stage_participants AS (
  SELECT
    pes.participant_id,
    pes.event_stage_id,
    ROW_NUMBER() OVER (PARTITION BY pes.event_stage_id ORDER BY md5(pes.participant_id::text)) AS rn,
    COUNT(*) OVER (PARTITION BY pes.event_stage_id) AS total
  FROM participant_event_stages pes
  JOIN participants p ON p.id = pes.participant_id
  WHERE pes.event_stage_id IN (
    '014641c9-ee48-4ee8-9556-5f9fc6bdf186',
    '58c8ea06-4652-4099-8aed-c05b0838a7d1'
  )
    AND p.is_active = true
    AND p.needs_meals = true
    AND p.credentialed_at IS NOT NULL
),

eligible AS (
  SELECT
    wc.window_id,
    sp.participant_id,
    mw.service_date,
    mw.start_time,
    CASE WHEN mw.end_time < mw.start_time
      THEN (mw.end_time + INTERVAL '24 hours' - mw.start_time)
      ELSE (mw.end_time - mw.start_time)
    END AS duration
  FROM window_config wc
  JOIN stage_participants sp ON sp.event_stage_id = wc.stage_id
  JOIN meal_windows mw ON mw.id = wc.window_id
  WHERE
    -- Filtro de grupo de localização
    (
      wc.location_group = 'all'
      OR (wc.location_group = 'A' AND sp.rn <= sp.total * 0.60)
      OR (wc.location_group = 'B' AND sp.rn > sp.total * 0.60)
    )
    AND
    -- Filtro de load% dentro do grupo
    (
      (wc.location_group = 'all'
        AND sp.rn <= sp.total * wc.load_pct)
      OR (wc.location_group = 'A'
        AND sp.rn <= sp.total * 0.60 * wc.load_pct)
      OR (wc.location_group = 'B'
        AND sp.rn > sp.total * 0.60
        AND sp.rn <= sp.total * (0.60 + 0.40 * wc.load_pct))
    )
    AND
    -- Sem registro duplicado nessa janela
    NOT EXISTS (
      SELECT 1 FROM meal_consumptions mc
      WHERE mc.meal_window_id = wc.window_id
        AND mc.participant_id = sp.participant_id
    )
    AND
    -- Excluir se já consumiu na janela alternativa (ef0e2b05 → 2cb71668)
    (
      wc.exclude_also IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM meal_consumptions mc2
        WHERE mc2.meal_window_id = wc.exclude_also
          AND mc2.participant_id = sp.participant_id
      )
    )
)

INSERT INTO meal_consumptions
  (id, meal_window_id, participant_id, consumed_at, registered_by, method, status, is_offline, duplicidade_detectada)
SELECT
  gen_random_uuid(),
  e.window_id,
  e.participant_id,
  -- Timestamp local Boa Vista dentro da janela, convertido para UTC
  (e.service_date + e.start_time) AT TIME ZONE 'America/Boa_Vista'
    + (random() * e.duration),
  -- Distribuição proporcional de operadores (hash determinístico por par participante+janela)
  CASE
    WHEN (abs(hashtext(e.participant_id::text || e.window_id::text)) % 20) < 5
      THEN '5687c396-2eec-4491-82ba-34a1214c3742'::uuid   -- 25%
    WHEN (abs(hashtext(e.participant_id::text || e.window_id::text)) % 20) < 8
      THEN '35e50c00-da57-4320-a0e8-510ca92e28e3'::uuid   -- 15%
    WHEN (abs(hashtext(e.participant_id::text || e.window_id::text)) % 20) < 10
      THEN 'de240914-c02c-499e-af2c-9f00ef2b5d78'::uuid   -- 10%
    ELSE  '010a43fd-f1ea-4ad7-b772-8cdcb519e410'::uuid   -- 50%
  END,
  'qr_scan',
  'active',
  false,
  false
FROM eligible e;
