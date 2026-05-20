-- Migration: 20260520020000_fix_meal_consumptions_bonfim.sql
-- Corrects three issues in Bonfim (etapa 014641c9) meal consumption data:
--   Fix 1: Delete "Teste" window (00e68088) consumos and deactivate window
--   Fix 2: School reassignment for 137 mismatched participants
--   Fix 3: Fix timestamps for Janta D1 Maciel Ribeiro (d0843320, cross-midnight bug)

-- ====================================================================
-- FIX 1: Janela "Teste"
-- ====================================================================
DELETE FROM meal_consumptions
WHERE meal_window_id = '00e68088-64f3-44fb-9341-ffe3ae474496';

UPDATE meal_windows
SET is_active = false
WHERE id = '00e68088-64f3-44fb-9341-ffe3ae474496';

-- ====================================================================
-- FIX 2: School reassignment
--
-- 42 participants classified as fix_a_to_m:
--   Pre-existing consumos at Maciel; migration put them at Aldébaro (wrong).
--   Action: move migration records from Aldébaro → Maciel, or delete if
--   participant already has a Maciel record for that meal.
--
-- 95 participants classified as fix_m_to_a:
--   Pre-existing consumos at Aldébaro; migration put them at Maciel (wrong).
--   Action: move migration records from Maciel → Aldébaro, or delete if
--   participant already has an Aldébaro record for that meal.
--
-- Window pairs (same day/meal, different school):
--   D1 Almoço:  Aldébaro f844ad04 ↔ Maciel 0e500125
--   D1 Janta:   Aldébaro f29340b2 ↔ Maciel d0843320 (cross-midnight)
--   D2 Café:    Aldébaro 62f9a0f6 ↔ Maciel 56367f15
--   D2 Almoço:  Aldébaro 50c2433f ↔ Maciel e458cd93
--   D2 Lanche:  Aldébaro 7f06eea0 ↔ Maciel 4c0dcbdf
--   D2 Janta:   Aldébaro 90fd21e3 ↔ Maciel 8235acc6
--   D3 Café:    Aldébaro 91e15e71 ↔ Maciel 0de89250
--   D3 Almoço:  Aldébaro 9143e0e1 ↔ Maciel d975d409
--   D3 Lanche:  Aldébaro c4c1db49 ↔ Maciel fb2c0b69
--   D3 Janta:   Aldébaro 9c41f6de ↔ Maciel b77f2cc5
--   D4 Café:    Aldébaro ea93b2f6 ↔ Maciel 8aefe648
--   D4 Almoço:  Aldébaro 1d0cc194 ↔ Maciel 8a05ca25
--   D4 Janta:   Aldébaro 533a997f ↔ Maciel 20014d6e
--   D5 Café:    Aldébaro f93609e9 only (no Maciel pair)
-- ====================================================================

-- ----------------------------------------------------------------
-- 2-A: fix_a_to_m — Delete migration Aldébaro records where Maciel
--      already has a record for this participant/meal
-- ----------------------------------------------------------------
WITH
  fix_pids(pid) AS (VALUES
    ('11e6c2f9-93b7-41c5-828f-3b651e96c534'::uuid),
    ('1c42ab80-9839-4105-9f65-46e922f94d9b'::uuid),
    ('2645f156-4b1f-46e6-b421-b294a442dce7'::uuid),
    ('2cc10161-20da-4ff6-b9b8-1dc2dfd4756d'::uuid),
    ('2e9cc4e3-f37f-4668-a410-871c52d6d13c'::uuid),
    ('33ad9464-4b74-49b3-94ae-d266bba2cb3a'::uuid),
    ('36acb092-19a2-49a5-80de-18f7fe4cd463'::uuid),
    ('39ea192a-a799-4f50-9f6b-b2c644592a61'::uuid),
    ('3f706f1d-3100-46a9-8ecc-64ee2c777215'::uuid),
    ('403db178-2ff9-4d77-8261-936a639f7f9f'::uuid),
    ('40a2e46a-27bb-475e-806b-3953f4c0d237'::uuid),
    ('425da7ca-05b5-4973-a8c0-c12fd2d4b993'::uuid),
    ('4bb34f94-04b6-4b36-9d94-6bb168e15399'::uuid),
    ('4ca59eb5-a014-433c-ae0e-3f0133048a5b'::uuid),
    ('5c28cde8-80ff-4bec-86b2-16fbf7fb9ed5'::uuid),
    ('5c6da0b4-07b5-4bd4-97ec-ef130609a69c'::uuid),
    ('5ffaf21c-045a-4e55-ac29-0b778a0aff64'::uuid),
    ('66cce10c-dd9c-41e1-9483-8666d7f64cc6'::uuid),
    ('6d30f081-e910-4b58-8639-17e5c98a755d'::uuid),
    ('7e290143-bc16-44a1-8998-690b2e57df89'::uuid),
    ('7f3b2598-c1b6-4856-8edd-3c8b4ba808dd'::uuid),
    ('865152b0-c85d-464b-8819-5b881c9130fd'::uuid),
    ('96b46425-dbc9-4eca-97c6-eacb1343af84'::uuid),
    ('a2a88540-1190-4ae1-8825-2a04b2f84f36'::uuid),
    ('af4181a0-b9b0-4906-9951-b50139ae4681'::uuid),
    ('b00f5668-1f0a-4e4a-b360-8b1309beb1e7'::uuid),
    ('b19aaf29-82c0-45b5-a4cc-02654756ad02'::uuid),
    ('b7e56b39-0ff2-460a-9053-dae2a401d620'::uuid),
    ('b827c931-4d17-4ff0-9009-2879d1b6a18b'::uuid),
    ('b8eadc80-2af7-4e97-8e42-8ea7e201ead5'::uuid),
    ('c438b2d1-7520-4374-834d-fd7e734054f3'::uuid),
    ('d07df4da-4e37-471d-9ab5-ab0b8d207478'::uuid),
    ('d661a313-b4b4-42fa-83e0-ae6d10a06f3e'::uuid),
    ('d7229c98-c6de-4343-bccc-fffa6ee6551c'::uuid),
    ('db01e1e3-20fb-48cc-934a-8d596bd6ebd8'::uuid),
    ('e0618009-8d18-4652-89a6-31d717973add'::uuid),
    ('e562c2a8-c124-4d36-b096-ce56d3c82e42'::uuid),
    ('e7e1c10b-1cfe-4d10-9c09-6dc647e501ea'::uuid),
    ('e90b35be-3153-4098-bc47-f07670f1fc7c'::uuid),
    ('fba0bedd-19fd-4979-a691-a41a9143adc2'::uuid),
    ('fde13c0e-d7d0-43fe-9451-e4e14b518d6f'::uuid),
    ('ff6f79ae-6c69-4ef4-b16f-67c43fe57312'::uuid)
  ),
  pairs(ald_id, mac_id) AS (VALUES
    ('f844ad04-acec-4db6-b0b6-5f1dac4dbb5f'::uuid, '0e500125-380e-461d-bade-1639190875b6'::uuid),
    ('f29340b2-d0b3-4edf-a55a-1faef5e32481'::uuid, 'd0843320-6e26-4021-9339-e773867a5270'::uuid),
    ('62f9a0f6-beea-42e9-bd82-77b241016ea4'::uuid, '56367f15-b8b3-4cd0-b4df-03ddcded5ae1'::uuid),
    ('50c2433f-22c2-487d-b581-4d8a020f2728'::uuid, 'e458cd93-4c8a-4eb4-933e-4aac73fcaf30'::uuid),
    ('7f06eea0-3ac2-4d0c-aa94-fc908cb64f4c'::uuid, '4c0dcbdf-6a4e-4761-9c49-120cf3e58646'::uuid),
    ('90fd21e3-7383-4301-9486-5aae62d4c1e0'::uuid, '8235acc6-3c41-4c20-b456-9db56b75755c'::uuid),
    ('91e15e71-642b-4826-8bd1-553d419958d3'::uuid, '0de89250-5dbf-4c18-a9e8-7e161d734570'::uuid),
    ('9143e0e1-4ec4-46fc-8969-f5ce8573889a'::uuid, 'd975d409-0b92-4e3f-bc2d-cf200832dcab'::uuid),
    ('c4c1db49-0b51-40cc-aa01-0908d6858393'::uuid, 'fb2c0b69-cf89-43da-9329-372f833b3c7f'::uuid),
    ('9c41f6de-6adc-434b-a903-db101a05ecc8'::uuid, 'b77f2cc5-6874-48b9-acdc-96cb1be567ae'::uuid),
    ('ea93b2f6-1e68-4cca-895b-929835d4df19'::uuid, '8aefe648-d1af-4b87-840d-09960de75009'::uuid),
    ('1d0cc194-3185-42dc-836b-d1ed7e14aee0'::uuid, '8a05ca25-ba46-4e28-8bae-c9e3e8d6a8b2'::uuid),
    ('533a997f-cabd-43d9-92fb-5c09313fa180'::uuid, '20014d6e-8b39-4c35-9081-3a2a544330cf'::uuid)
  )
DELETE FROM meal_consumptions mc
USING fix_pids f, pairs p
WHERE mc.participant_id = f.pid
  AND mc.meal_window_id = p.ald_id
  AND mc.created_at::date = '2026-05-20'
  AND EXISTS (
    SELECT 1 FROM meal_consumptions e
    WHERE e.meal_window_id = p.mac_id
      AND e.participant_id = f.pid
  );

-- ----------------------------------------------------------------
-- 2-B: fix_a_to_m — Update remaining migration Aldébaro records → Maciel
--      (cases where no pre-existing Maciel record exists for that meal)
-- ----------------------------------------------------------------
WITH
  fix_pids(pid) AS (VALUES
    ('11e6c2f9-93b7-41c5-828f-3b651e96c534'::uuid),
    ('1c42ab80-9839-4105-9f65-46e922f94d9b'::uuid),
    ('2645f156-4b1f-46e6-b421-b294a442dce7'::uuid),
    ('2cc10161-20da-4ff6-b9b8-1dc2dfd4756d'::uuid),
    ('2e9cc4e3-f37f-4668-a410-871c52d6d13c'::uuid),
    ('33ad9464-4b74-49b3-94ae-d266bba2cb3a'::uuid),
    ('36acb092-19a2-49a5-80de-18f7fe4cd463'::uuid),
    ('39ea192a-a799-4f50-9f6b-b2c644592a61'::uuid),
    ('3f706f1d-3100-46a9-8ecc-64ee2c777215'::uuid),
    ('403db178-2ff9-4d77-8261-936a639f7f9f'::uuid),
    ('40a2e46a-27bb-475e-806b-3953f4c0d237'::uuid),
    ('425da7ca-05b5-4973-a8c0-c12fd2d4b993'::uuid),
    ('4bb34f94-04b6-4b36-9d94-6bb168e15399'::uuid),
    ('4ca59eb5-a014-433c-ae0e-3f0133048a5b'::uuid),
    ('5c28cde8-80ff-4bec-86b2-16fbf7fb9ed5'::uuid),
    ('5c6da0b4-07b5-4bd4-97ec-ef130609a69c'::uuid),
    ('5ffaf21c-045a-4e55-ac29-0b778a0aff64'::uuid),
    ('66cce10c-dd9c-41e1-9483-8666d7f64cc6'::uuid),
    ('6d30f081-e910-4b58-8639-17e5c98a755d'::uuid),
    ('7e290143-bc16-44a1-8998-690b2e57df89'::uuid),
    ('7f3b2598-c1b6-4856-8edd-3c8b4ba808dd'::uuid),
    ('865152b0-c85d-464b-8819-5b881c9130fd'::uuid),
    ('96b46425-dbc9-4eca-97c6-eacb1343af84'::uuid),
    ('a2a88540-1190-4ae1-8825-2a04b2f84f36'::uuid),
    ('af4181a0-b9b0-4906-9951-b50139ae4681'::uuid),
    ('b00f5668-1f0a-4e4a-b360-8b1309beb1e7'::uuid),
    ('b19aaf29-82c0-45b5-a4cc-02654756ad02'::uuid),
    ('b7e56b39-0ff2-460a-9053-dae2a401d620'::uuid),
    ('b827c931-4d17-4ff0-9009-2879d1b6a18b'::uuid),
    ('b8eadc80-2af7-4e97-8e42-8ea7e201ead5'::uuid),
    ('c438b2d1-7520-4374-834d-fd7e734054f3'::uuid),
    ('d07df4da-4e37-471d-9ab5-ab0b8d207478'::uuid),
    ('d661a313-b4b4-42fa-83e0-ae6d10a06f3e'::uuid),
    ('d7229c98-c6de-4343-bccc-fffa6ee6551c'::uuid),
    ('db01e1e3-20fb-48cc-934a-8d596bd6ebd8'::uuid),
    ('e0618009-8d18-4652-89a6-31d717973add'::uuid),
    ('e562c2a8-c124-4d36-b096-ce56d3c82e42'::uuid),
    ('e7e1c10b-1cfe-4d10-9c09-6dc647e501ea'::uuid),
    ('e90b35be-3153-4098-bc47-f07670f1fc7c'::uuid),
    ('fba0bedd-19fd-4979-a691-a41a9143adc2'::uuid),
    ('fde13c0e-d7d0-43fe-9451-e4e14b518d6f'::uuid),
    ('ff6f79ae-6c69-4ef4-b16f-67c43fe57312'::uuid)
  ),
  pairs(ald_id, mac_id) AS (VALUES
    ('f844ad04-acec-4db6-b0b6-5f1dac4dbb5f'::uuid, '0e500125-380e-461d-bade-1639190875b6'::uuid),
    ('f29340b2-d0b3-4edf-a55a-1faef5e32481'::uuid, 'd0843320-6e26-4021-9339-e773867a5270'::uuid),
    ('62f9a0f6-beea-42e9-bd82-77b241016ea4'::uuid, '56367f15-b8b3-4cd0-b4df-03ddcded5ae1'::uuid),
    ('50c2433f-22c2-487d-b581-4d8a020f2728'::uuid, 'e458cd93-4c8a-4eb4-933e-4aac73fcaf30'::uuid),
    ('7f06eea0-3ac2-4d0c-aa94-fc908cb64f4c'::uuid, '4c0dcbdf-6a4e-4761-9c49-120cf3e58646'::uuid),
    ('90fd21e3-7383-4301-9486-5aae62d4c1e0'::uuid, '8235acc6-3c41-4c20-b456-9db56b75755c'::uuid),
    ('91e15e71-642b-4826-8bd1-553d419958d3'::uuid, '0de89250-5dbf-4c18-a9e8-7e161d734570'::uuid),
    ('9143e0e1-4ec4-46fc-8969-f5ce8573889a'::uuid, 'd975d409-0b92-4e3f-bc2d-cf200832dcab'::uuid),
    ('c4c1db49-0b51-40cc-aa01-0908d6858393'::uuid, 'fb2c0b69-cf89-43da-9329-372f833b3c7f'::uuid),
    ('9c41f6de-6adc-434b-a903-db101a05ecc8'::uuid, 'b77f2cc5-6874-48b9-acdc-96cb1be567ae'::uuid),
    ('ea93b2f6-1e68-4cca-895b-929835d4df19'::uuid, '8aefe648-d1af-4b87-840d-09960de75009'::uuid),
    ('1d0cc194-3185-42dc-836b-d1ed7e14aee0'::uuid, '8a05ca25-ba46-4e28-8bae-c9e3e8d6a8b2'::uuid),
    ('533a997f-cabd-43d9-92fb-5c09313fa180'::uuid, '20014d6e-8b39-4c35-9081-3a2a544330cf'::uuid)
  )
UPDATE meal_consumptions mc
SET
  meal_window_id = p.mac_id,
  consumed_at = make_timestamptz(
    EXTRACT(year  FROM mw.service_date)::int,
    EXTRACT(month FROM mw.service_date)::int,
    EXTRACT(day   FROM mw.service_date)::int,
    EXTRACT(hour  FROM mw.start_time)::int,
    EXTRACT(minute FROM mw.start_time)::int,
    0,
    'America/Boa_Vista'
  ) + random() * CASE
      WHEN mw.end_time < mw.start_time
      THEN mw.end_time::interval + INTERVAL '24 hours' - mw.start_time::interval
      ELSE mw.end_time::interval - mw.start_time::interval
    END
FROM fix_pids f, pairs p, meal_windows mw
WHERE mc.participant_id = f.pid
  AND mc.meal_window_id = p.ald_id
  AND mw.id = p.mac_id
  AND mc.created_at::date = '2026-05-20'
  AND NOT EXISTS (
    SELECT 1 FROM meal_consumptions e
    WHERE e.meal_window_id = p.mac_id
      AND e.participant_id = f.pid
  );

-- ----------------------------------------------------------------
-- 2-C: fix_a_to_m — Delete D5 Café migration records (no Maciel pair)
--      fix_a_to_m participants' real school is Maciel; Maciel has no D5 window
-- ----------------------------------------------------------------
WITH fix_pids(pid) AS (VALUES
    ('11e6c2f9-93b7-41c5-828f-3b651e96c534'::uuid),
    ('1c42ab80-9839-4105-9f65-46e922f94d9b'::uuid),
    ('2645f156-4b1f-46e6-b421-b294a442dce7'::uuid),
    ('2cc10161-20da-4ff6-b9b8-1dc2dfd4756d'::uuid),
    ('2e9cc4e3-f37f-4668-a410-871c52d6d13c'::uuid),
    ('33ad9464-4b74-49b3-94ae-d266bba2cb3a'::uuid),
    ('36acb092-19a2-49a5-80de-18f7fe4cd463'::uuid),
    ('39ea192a-a799-4f50-9f6b-b2c644592a61'::uuid),
    ('3f706f1d-3100-46a9-8ecc-64ee2c777215'::uuid),
    ('403db178-2ff9-4d77-8261-936a639f7f9f'::uuid),
    ('40a2e46a-27bb-475e-806b-3953f4c0d237'::uuid),
    ('425da7ca-05b5-4973-a8c0-c12fd2d4b993'::uuid),
    ('4bb34f94-04b6-4b36-9d94-6bb168e15399'::uuid),
    ('4ca59eb5-a014-433c-ae0e-3f0133048a5b'::uuid),
    ('5c28cde8-80ff-4bec-86b2-16fbf7fb9ed5'::uuid),
    ('5c6da0b4-07b5-4bd4-97ec-ef130609a69c'::uuid),
    ('5ffaf21c-045a-4e55-ac29-0b778a0aff64'::uuid),
    ('66cce10c-dd9c-41e1-9483-8666d7f64cc6'::uuid),
    ('6d30f081-e910-4b58-8639-17e5c98a755d'::uuid),
    ('7e290143-bc16-44a1-8998-690b2e57df89'::uuid),
    ('7f3b2598-c1b6-4856-8edd-3c8b4ba808dd'::uuid),
    ('865152b0-c85d-464b-8819-5b881c9130fd'::uuid),
    ('96b46425-dbc9-4eca-97c6-eacb1343af84'::uuid),
    ('a2a88540-1190-4ae1-8825-2a04b2f84f36'::uuid),
    ('af4181a0-b9b0-4906-9951-b50139ae4681'::uuid),
    ('b00f5668-1f0a-4e4a-b360-8b1309beb1e7'::uuid),
    ('b19aaf29-82c0-45b5-a4cc-02654756ad02'::uuid),
    ('b7e56b39-0ff2-460a-9053-dae2a401d620'::uuid),
    ('b827c931-4d17-4ff0-9009-2879d1b6a18b'::uuid),
    ('b8eadc80-2af7-4e97-8e42-8ea7e201ead5'::uuid),
    ('c438b2d1-7520-4374-834d-fd7e734054f3'::uuid),
    ('d07df4da-4e37-471d-9ab5-ab0b8d207478'::uuid),
    ('d661a313-b4b4-42fa-83e0-ae6d10a06f3e'::uuid),
    ('d7229c98-c6de-4343-bccc-fffa6ee6551c'::uuid),
    ('db01e1e3-20fb-48cc-934a-8d596bd6ebd8'::uuid),
    ('e0618009-8d18-4652-89a6-31d717973add'::uuid),
    ('e562c2a8-c124-4d36-b096-ce56d3c82e42'::uuid),
    ('e7e1c10b-1cfe-4d10-9c09-6dc647e501ea'::uuid),
    ('e90b35be-3153-4098-bc47-f07670f1fc7c'::uuid),
    ('fba0bedd-19fd-4979-a691-a41a9143adc2'::uuid),
    ('fde13c0e-d7d0-43fe-9451-e4e14b518d6f'::uuid),
    ('ff6f79ae-6c69-4ef4-b16f-67c43fe57312'::uuid)
)
DELETE FROM meal_consumptions mc
USING fix_pids f
WHERE mc.participant_id = f.pid
  AND mc.meal_window_id = 'f93609e9-42cc-4f41-9f45-cc1006b10cda'::uuid
  AND mc.created_at::date = '2026-05-20';

-- ----------------------------------------------------------------
-- 2-D: fix_m_to_a — Delete migration Maciel records where Aldébaro
--      already has a record for this participant/meal
-- ----------------------------------------------------------------
WITH
  fix_pids(pid) AS (VALUES
    ('07a2d4b1-e8ef-45f6-a112-545f7eee1000'::uuid),
    ('090aa429-142a-4314-8c84-125b70dd9329'::uuid),
    ('0f9a3c7c-44d1-4f9f-8062-9c7b4c7e1f45'::uuid),
    ('12d021a8-ec60-4591-97c7-15905964af76'::uuid),
    ('17ae2c8a-388d-460e-acad-5c46661fd219'::uuid),
    ('190d6adc-59ca-41ea-aa3d-c03455d949c8'::uuid),
    ('192270a4-c479-497d-9d4b-75c662c0599c'::uuid),
    ('1e6f8e48-5799-42c9-b61a-2eb902eaea79'::uuid),
    ('268a1b26-401b-40ac-af9e-2890fe20cc76'::uuid),
    ('2de7569e-9540-4644-9890-8cfe6326c927'::uuid),
    ('30151b6d-04aa-4b6a-8f45-a79931dbdc6f'::uuid),
    ('37099a4f-3915-4a96-bb1a-0306d4247bc1'::uuid),
    ('398f63db-bdd4-408a-a0cc-2f1186f757c4'::uuid),
    ('3a0951c1-3080-4623-9cc5-d05ea796fba3'::uuid),
    ('3c6b9748-22a2-4f53-a096-a72d44f203b1'::uuid),
    ('3e2cb453-a4bc-4b84-a2e1-6b2b715ea892'::uuid),
    ('4089c08e-d594-423e-8526-f1aaefad4144'::uuid),
    ('467ab4b5-e46e-4861-9003-f71d3e6f6508'::uuid),
    ('4aecaa42-941a-40fd-a0f8-09dd8827a4a7'::uuid),
    ('4c38481a-b8d3-4b9a-b812-1d1911257c6e'::uuid),
    ('517b28eb-4dfd-496c-8a67-9943603d720c'::uuid),
    ('561764fb-a382-46db-9ce2-8d768ec72ad5'::uuid),
    ('5b917a19-932d-44ad-bc29-71b3962048bc'::uuid),
    ('5ba74a16-604e-4cd6-8224-1a8eb10945bc'::uuid),
    ('60ecf7f3-3b4d-449d-bd70-68352be65b21'::uuid),
    ('6108cb25-141e-4bbd-909e-e80c47ac4a59'::uuid),
    ('6327b7d7-6559-4b13-a53d-23f04b96c471'::uuid),
    ('65aaae5b-3a4c-484c-9ba7-2c58dd0cf219'::uuid),
    ('69730e5d-f058-437b-a5a8-78756d29c661'::uuid),
    ('6ce36aa1-dcde-4949-8707-6606ae51d80b'::uuid),
    ('6dee249f-ebc0-4aaa-8710-34d6637b827b'::uuid),
    ('70538106-7b92-49cf-ba13-0b3e3c78f5f2'::uuid),
    ('70f15760-6f3c-45d6-be30-e75a17f493c5'::uuid),
    ('712bb87c-fd3e-4009-bb89-3faf9654ae1b'::uuid),
    ('7ef6a2f0-63d8-411e-8232-fb48d7d10807'::uuid),
    ('8051a53e-9b7f-4544-b3a2-4ebe802e20f6'::uuid),
    ('83a7d625-1085-4ee6-a2ea-dac10f87c7b9'::uuid),
    ('8db7f3e9-d006-4051-90a2-9487fd637680'::uuid),
    ('9062f760-2c3e-492e-aef1-8a7224f2e03f'::uuid),
    ('949edaae-6cef-4357-9eb8-e4f648ae5f2f'::uuid),
    ('979ebe25-a9f9-4a34-b59c-eec047f8728a'::uuid),
    ('9966881e-57e0-4ddf-aaee-11c44133636c'::uuid),
    ('9c306d94-82a4-4303-92e0-77df1322a991'::uuid),
    ('a3b0392c-a557-402a-9864-8d350e74e08d'::uuid),
    ('a68fc422-57cd-4907-9701-620097fefd5d'::uuid),
    ('a75ef400-acea-4338-9297-5a79bc2cb59f'::uuid),
    ('a7865f8d-4324-493d-af00-23873ca6fc37'::uuid),
    ('a7a1888a-f068-4619-a428-fb3a629274ab'::uuid),
    ('aa73fe52-c9be-4370-b30f-5bf036fc2a79'::uuid),
    ('aa88691a-b736-42b8-9960-8da344fb4bd5'::uuid),
    ('ab7403ae-c315-4668-83a0-e47914f1ff3b'::uuid),
    ('ace33a18-94e2-4bbf-919d-b4887bcf960b'::uuid),
    ('aeeb8a9d-9432-499c-8dc8-cf47fa3afdd1'::uuid),
    ('b0bcee0b-83c5-4280-8d69-0ef265783f58'::uuid),
    ('b546f677-ff45-4f2f-a38f-6604009f4d44'::uuid),
    ('bbb1a00f-dbc4-421a-8ebe-640863e46dc7'::uuid),
    ('bc20b5ea-76aa-4c93-b3e9-010572dd64f3'::uuid),
    ('bc2699f4-1b54-4c1f-a1d7-30e2bbea327a'::uuid),
    ('bd0dfa6b-c890-4e0e-a2fd-9890f53ca303'::uuid),
    ('bdc50409-6009-4318-a9a7-542a384370c0'::uuid),
    ('be91bffb-b1a9-4564-9134-e5d402466ff0'::uuid),
    ('bf55e560-3ff6-443b-9034-61a0df6777e5'::uuid),
    ('bf6a3fa5-766a-47a7-9b6f-3a30e015be6d'::uuid),
    ('c46497c8-53a6-479c-9af5-349f11bc95ca'::uuid),
    ('c4a551d9-1378-40a4-a4bf-ed85af0c2178'::uuid),
    ('c5a79491-9369-4baa-b407-5c8e2ed3380f'::uuid),
    ('c5c503d2-c2bb-4556-877f-0fad7b5bcbff'::uuid),
    ('c6e16bf2-a320-4904-b09d-29d47b30c4ae'::uuid),
    ('c7453cbf-7367-44d7-bf60-414b878aea39'::uuid),
    ('cd06ab16-09e5-4cd2-b152-75964bfe2cec'::uuid),
    ('ce960ba7-e486-4534-850b-91b9c590eacd'::uuid),
    ('d2f8fb9b-653b-49d4-89c1-fd49658a0e85'::uuid),
    ('d304c1bd-1e98-4931-932c-59ac3d11d77e'::uuid),
    ('d3faf0b0-a0b9-47ab-89f6-df5e2e923882'::uuid),
    ('d6b7c628-8c9a-4c5c-b99a-7857ff37b69b'::uuid),
    ('dad38083-03cd-4ac1-81de-4b3974521191'::uuid),
    ('dbf71209-9e49-4efd-af61-49a507aaa767'::uuid),
    ('e105c7d3-11f4-4fea-9d7f-9266049b8cb5'::uuid),
    ('e15d99a1-32ec-4866-bea9-992302ebad3f'::uuid),
    ('e2a95278-0d53-4d61-82f0-25ddee3b72c2'::uuid),
    ('e2e7ef23-1944-40ad-bc4e-1b122efa2d05'::uuid),
    ('e361c5e3-0622-4a0e-a726-b341c4d162d4'::uuid),
    ('e3d56755-0793-479e-97ef-724533a8080d'::uuid),
    ('e60aa9f4-3932-4d14-973b-fe83dcc8484f'::uuid),
    ('e758fb5c-1ba2-46a8-aa61-0ea033a5ae8e'::uuid),
    ('e7d4d870-eb3e-49ab-a319-523320514bd5'::uuid),
    ('e8221a12-4a86-402f-8d5f-5c9bda12aaf4'::uuid),
    ('e8a05004-447d-4e1b-9ab8-b90a1d798a08'::uuid),
    ('e994a68e-6af9-4df9-935c-9bddfd8dc1e7'::uuid),
    ('ed41a168-4d9d-48a1-aa45-6e5df88876a4'::uuid),
    ('efd6d464-4f6a-4a8e-9f8c-199e76d6fc16'::uuid),
    ('f9bab9fc-590f-4b51-a181-fb41c5059737'::uuid),
    ('fa4f8758-5dae-4912-953a-477fb8f8fea5'::uuid),
    ('fdcce9ce-d61a-4386-881c-db36f3d4697b'::uuid),
    ('ff808638-ea75-41cf-a5e7-22c9e488d5a4'::uuid)
  ),
  pairs(ald_id, mac_id) AS (VALUES
    ('f844ad04-acec-4db6-b0b6-5f1dac4dbb5f'::uuid, '0e500125-380e-461d-bade-1639190875b6'::uuid),
    ('f29340b2-d0b3-4edf-a55a-1faef5e32481'::uuid, 'd0843320-6e26-4021-9339-e773867a5270'::uuid),
    ('62f9a0f6-beea-42e9-bd82-77b241016ea4'::uuid, '56367f15-b8b3-4cd0-b4df-03ddcded5ae1'::uuid),
    ('50c2433f-22c2-487d-b581-4d8a020f2728'::uuid, 'e458cd93-4c8a-4eb4-933e-4aac73fcaf30'::uuid),
    ('7f06eea0-3ac2-4d0c-aa94-fc908cb64f4c'::uuid, '4c0dcbdf-6a4e-4761-9c49-120cf3e58646'::uuid),
    ('90fd21e3-7383-4301-9486-5aae62d4c1e0'::uuid, '8235acc6-3c41-4c20-b456-9db56b75755c'::uuid),
    ('91e15e71-642b-4826-8bd1-553d419958d3'::uuid, '0de89250-5dbf-4c18-a9e8-7e161d734570'::uuid),
    ('9143e0e1-4ec4-46fc-8969-f5ce8573889a'::uuid, 'd975d409-0b92-4e3f-bc2d-cf200832dcab'::uuid),
    ('c4c1db49-0b51-40cc-aa01-0908d6858393'::uuid, 'fb2c0b69-cf89-43da-9329-372f833b3c7f'::uuid),
    ('9c41f6de-6adc-434b-a903-db101a05ecc8'::uuid, 'b77f2cc5-6874-48b9-acdc-96cb1be567ae'::uuid),
    ('ea93b2f6-1e68-4cca-895b-929835d4df19'::uuid, '8aefe648-d1af-4b87-840d-09960de75009'::uuid),
    ('1d0cc194-3185-42dc-836b-d1ed7e14aee0'::uuid, '8a05ca25-ba46-4e28-8bae-c9e3e8d6a8b2'::uuid),
    ('533a997f-cabd-43d9-92fb-5c09313fa180'::uuid, '20014d6e-8b39-4c35-9081-3a2a544330cf'::uuid)
  )
DELETE FROM meal_consumptions mc
USING fix_pids f, pairs p
WHERE mc.participant_id = f.pid
  AND mc.meal_window_id = p.mac_id
  AND mc.created_at::date = '2026-05-20'
  AND EXISTS (
    SELECT 1 FROM meal_consumptions e
    WHERE e.meal_window_id = p.ald_id
      AND e.participant_id = f.pid
  );

-- ----------------------------------------------------------------
-- 2-E: fix_m_to_a — Update remaining migration Maciel records → Aldébaro
--      (cases where no pre-existing Aldébaro record exists for that meal)
-- ----------------------------------------------------------------
WITH
  fix_pids(pid) AS (VALUES
    ('07a2d4b1-e8ef-45f6-a112-545f7eee1000'::uuid),
    ('090aa429-142a-4314-8c84-125b70dd9329'::uuid),
    ('0f9a3c7c-44d1-4f9f-8062-9c7b4c7e1f45'::uuid),
    ('12d021a8-ec60-4591-97c7-15905964af76'::uuid),
    ('17ae2c8a-388d-460e-acad-5c46661fd219'::uuid),
    ('190d6adc-59ca-41ea-aa3d-c03455d949c8'::uuid),
    ('192270a4-c479-497d-9d4b-75c662c0599c'::uuid),
    ('1e6f8e48-5799-42c9-b61a-2eb902eaea79'::uuid),
    ('268a1b26-401b-40ac-af9e-2890fe20cc76'::uuid),
    ('2de7569e-9540-4644-9890-8cfe6326c927'::uuid),
    ('30151b6d-04aa-4b6a-8f45-a79931dbdc6f'::uuid),
    ('37099a4f-3915-4a96-bb1a-0306d4247bc1'::uuid),
    ('398f63db-bdd4-408a-a0cc-2f1186f757c4'::uuid),
    ('3a0951c1-3080-4623-9cc5-d05ea796fba3'::uuid),
    ('3c6b9748-22a2-4f53-a096-a72d44f203b1'::uuid),
    ('3e2cb453-a4bc-4b84-a2e1-6b2b715ea892'::uuid),
    ('4089c08e-d594-423e-8526-f1aaefad4144'::uuid),
    ('467ab4b5-e46e-4861-9003-f71d3e6f6508'::uuid),
    ('4aecaa42-941a-40fd-a0f8-09dd8827a4a7'::uuid),
    ('4c38481a-b8d3-4b9a-b812-1d1911257c6e'::uuid),
    ('517b28eb-4dfd-496c-8a67-9943603d720c'::uuid),
    ('561764fb-a382-46db-9ce2-8d768ec72ad5'::uuid),
    ('5b917a19-932d-44ad-bc29-71b3962048bc'::uuid),
    ('5ba74a16-604e-4cd6-8224-1a8eb10945bc'::uuid),
    ('60ecf7f3-3b4d-449d-bd70-68352be65b21'::uuid),
    ('6108cb25-141e-4bbd-909e-e80c47ac4a59'::uuid),
    ('6327b7d7-6559-4b13-a53d-23f04b96c471'::uuid),
    ('65aaae5b-3a4c-484c-9ba7-2c58dd0cf219'::uuid),
    ('69730e5d-f058-437b-a5a8-78756d29c661'::uuid),
    ('6ce36aa1-dcde-4949-8707-6606ae51d80b'::uuid),
    ('6dee249f-ebc0-4aaa-8710-34d6637b827b'::uuid),
    ('70538106-7b92-49cf-ba13-0b3e3c78f5f2'::uuid),
    ('70f15760-6f3c-45d6-be30-e75a17f493c5'::uuid),
    ('712bb87c-fd3e-4009-bb89-3faf9654ae1b'::uuid),
    ('7ef6a2f0-63d8-411e-8232-fb48d7d10807'::uuid),
    ('8051a53e-9b7f-4544-b3a2-4ebe802e20f6'::uuid),
    ('83a7d625-1085-4ee6-a2ea-dac10f87c7b9'::uuid),
    ('8db7f3e9-d006-4051-90a2-9487fd637680'::uuid),
    ('9062f760-2c3e-492e-aef1-8a7224f2e03f'::uuid),
    ('949edaae-6cef-4357-9eb8-e4f648ae5f2f'::uuid),
    ('979ebe25-a9f9-4a34-b59c-eec047f8728a'::uuid),
    ('9966881e-57e0-4ddf-aaee-11c44133636c'::uuid),
    ('9c306d94-82a4-4303-92e0-77df1322a991'::uuid),
    ('a3b0392c-a557-402a-9864-8d350e74e08d'::uuid),
    ('a68fc422-57cd-4907-9701-620097fefd5d'::uuid),
    ('a75ef400-acea-4338-9297-5a79bc2cb59f'::uuid),
    ('a7865f8d-4324-493d-af00-23873ca6fc37'::uuid),
    ('a7a1888a-f068-4619-a428-fb3a629274ab'::uuid),
    ('aa73fe52-c9be-4370-b30f-5bf036fc2a79'::uuid),
    ('aa88691a-b736-42b8-9960-8da344fb4bd5'::uuid),
    ('ab7403ae-c315-4668-83a0-e47914f1ff3b'::uuid),
    ('ace33a18-94e2-4bbf-919d-b4887bcf960b'::uuid),
    ('aeeb8a9d-9432-499c-8dc8-cf47fa3afdd1'::uuid),
    ('b0bcee0b-83c5-4280-8d69-0ef265783f58'::uuid),
    ('b546f677-ff45-4f2f-a38f-6604009f4d44'::uuid),
    ('bbb1a00f-dbc4-421a-8ebe-640863e46dc7'::uuid),
    ('bc20b5ea-76aa-4c93-b3e9-010572dd64f3'::uuid),
    ('bc2699f4-1b54-4c1f-a1d7-30e2bbea327a'::uuid),
    ('bd0dfa6b-c890-4e0e-a2fd-9890f53ca303'::uuid),
    ('bdc50409-6009-4318-a9a7-542a384370c0'::uuid),
    ('be91bffb-b1a9-4564-9134-e5d402466ff0'::uuid),
    ('bf55e560-3ff6-443b-9034-61a0df6777e5'::uuid),
    ('bf6a3fa5-766a-47a7-9b6f-3a30e015be6d'::uuid),
    ('c46497c8-53a6-479c-9af5-349f11bc95ca'::uuid),
    ('c4a551d9-1378-40a4-a4bf-ed85af0c2178'::uuid),
    ('c5a79491-9369-4baa-b407-5c8e2ed3380f'::uuid),
    ('c5c503d2-c2bb-4556-877f-0fad7b5bcbff'::uuid),
    ('c6e16bf2-a320-4904-b09d-29d47b30c4ae'::uuid),
    ('c7453cbf-7367-44d7-bf60-414b878aea39'::uuid),
    ('cd06ab16-09e5-4cd2-b152-75964bfe2cec'::uuid),
    ('ce960ba7-e486-4534-850b-91b9c590eacd'::uuid),
    ('d2f8fb9b-653b-49d4-89c1-fd49658a0e85'::uuid),
    ('d304c1bd-1e98-4931-932c-59ac3d11d77e'::uuid),
    ('d3faf0b0-a0b9-47ab-89f6-df5e2e923882'::uuid),
    ('d6b7c628-8c9a-4c5c-b99a-7857ff37b69b'::uuid),
    ('dad38083-03cd-4ac1-81de-4b3974521191'::uuid),
    ('dbf71209-9e49-4efd-af61-49a507aaa767'::uuid),
    ('e105c7d3-11f4-4fea-9d7f-9266049b8cb5'::uuid),
    ('e15d99a1-32ec-4866-bea9-992302ebad3f'::uuid),
    ('e2a95278-0d53-4d61-82f0-25ddee3b72c2'::uuid),
    ('e2e7ef23-1944-40ad-bc4e-1b122efa2d05'::uuid),
    ('e361c5e3-0622-4a0e-a726-b341c4d162d4'::uuid),
    ('e3d56755-0793-479e-97ef-724533a8080d'::uuid),
    ('e60aa9f4-3932-4d14-973b-fe83dcc8484f'::uuid),
    ('e758fb5c-1ba2-46a8-aa61-0ea033a5ae8e'::uuid),
    ('e7d4d870-eb3e-49ab-a319-523320514bd5'::uuid),
    ('e8221a12-4a86-402f-8d5f-5c9bda12aaf4'::uuid),
    ('e8a05004-447d-4e1b-9ab8-b90a1d798a08'::uuid),
    ('e994a68e-6af9-4df9-935c-9bddfd8dc1e7'::uuid),
    ('ed41a168-4d9d-48a1-aa45-6e5df88876a4'::uuid),
    ('efd6d464-4f6a-4a8e-9f8c-199e76d6fc16'::uuid),
    ('f9bab9fc-590f-4b51-a181-fb41c5059737'::uuid),
    ('fa4f8758-5dae-4912-953a-477fb8f8fea5'::uuid),
    ('fdcce9ce-d61a-4386-881c-db36f3d4697b'::uuid),
    ('ff808638-ea75-41cf-a5e7-22c9e488d5a4'::uuid)
  ),
  pairs(ald_id, mac_id) AS (VALUES
    ('f844ad04-acec-4db6-b0b6-5f1dac4dbb5f'::uuid, '0e500125-380e-461d-bade-1639190875b6'::uuid),
    ('f29340b2-d0b3-4edf-a55a-1faef5e32481'::uuid, 'd0843320-6e26-4021-9339-e773867a5270'::uuid),
    ('62f9a0f6-beea-42e9-bd82-77b241016ea4'::uuid, '56367f15-b8b3-4cd0-b4df-03ddcded5ae1'::uuid),
    ('50c2433f-22c2-487d-b581-4d8a020f2728'::uuid, 'e458cd93-4c8a-4eb4-933e-4aac73fcaf30'::uuid),
    ('7f06eea0-3ac2-4d0c-aa94-fc908cb64f4c'::uuid, '4c0dcbdf-6a4e-4761-9c49-120cf3e58646'::uuid),
    ('90fd21e3-7383-4301-9486-5aae62d4c1e0'::uuid, '8235acc6-3c41-4c20-b456-9db56b75755c'::uuid),
    ('91e15e71-642b-4826-8bd1-553d419958d3'::uuid, '0de89250-5dbf-4c18-a9e8-7e161d734570'::uuid),
    ('9143e0e1-4ec4-46fc-8969-f5ce8573889a'::uuid, 'd975d409-0b92-4e3f-bc2d-cf200832dcab'::uuid),
    ('c4c1db49-0b51-40cc-aa01-0908d6858393'::uuid, 'fb2c0b69-cf89-43da-9329-372f833b3c7f'::uuid),
    ('9c41f6de-6adc-434b-a903-db101a05ecc8'::uuid, 'b77f2cc5-6874-48b9-acdc-96cb1be567ae'::uuid),
    ('ea93b2f6-1e68-4cca-895b-929835d4df19'::uuid, '8aefe648-d1af-4b87-840d-09960de75009'::uuid),
    ('1d0cc194-3185-42dc-836b-d1ed7e14aee0'::uuid, '8a05ca25-ba46-4e28-8bae-c9e3e8d6a8b2'::uuid),
    ('533a997f-cabd-43d9-92fb-5c09313fa180'::uuid, '20014d6e-8b39-4c35-9081-3a2a544330cf'::uuid)
  )
UPDATE meal_consumptions mc
SET
  meal_window_id = p.ald_id,
  consumed_at = make_timestamptz(
    EXTRACT(year  FROM mw.service_date)::int,
    EXTRACT(month FROM mw.service_date)::int,
    EXTRACT(day   FROM mw.service_date)::int,
    EXTRACT(hour  FROM mw.start_time)::int,
    EXTRACT(minute FROM mw.start_time)::int,
    0,
    'America/Boa_Vista'
  ) + random() * CASE
      WHEN mw.end_time < mw.start_time
      THEN mw.end_time::interval + INTERVAL '24 hours' - mw.start_time::interval
      ELSE mw.end_time::interval - mw.start_time::interval
    END
FROM fix_pids f, pairs p, meal_windows mw
WHERE mc.participant_id = f.pid
  AND mc.meal_window_id = p.mac_id
  AND mw.id = p.ald_id
  AND mc.created_at::date = '2026-05-20'
  AND NOT EXISTS (
    SELECT 1 FROM meal_consumptions e
    WHERE e.meal_window_id = p.ald_id
      AND e.participant_id = f.pid
  );

-- ====================================================================
-- FIX 3: Correct timestamps for Janta D1 Maciel Ribeiro (window d0843320)
-- Window: service_date=2026-05-14, start_time=18:30, end_time=00:30
-- Duration = 6 hours (cross-midnight). Original migration used incorrect
-- TIME + INTERVAL arithmetic that wrapped, producing negative durations.
-- Only migration records (created_at = 2026-05-20) need correction;
-- pre-existing records are real operational scans.
-- ====================================================================
UPDATE meal_consumptions
SET consumed_at =
  make_timestamptz(2026, 5, 14, 18, 30, 0, 'America/Boa_Vista')
  + random() * ('00:30:00'::interval + INTERVAL '24 hours' - '18:30:00'::interval)
WHERE meal_window_id = 'd0843320-6e26-4021-9339-e773867a5270'::uuid
  AND created_at::date = '2026-05-20';
