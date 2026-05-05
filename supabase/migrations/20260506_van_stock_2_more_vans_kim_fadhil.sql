-- 20260506_van_stock_2_more_vans_kim_fadhil.sql
--
-- Additional Van Stock data for 2 more technicians, from Shin's xlsx
-- checklists added 2026-05-05 (afternoon, post first daily commit):
--   - FADHIL (tech19) plate VCS 6852  — checked 2026-04-16
--   - KIM    (tech1)  plate BRM 6332  — checked 2026-04-24
--
-- This is a follow-on to:
--   - 20260424_van_stock_6_vans_initial.sql (BASRI/BON/FIRDAUS/HAFIZ/HAN/HASRUL)
--   - 20260504_van_stock_3_vans_addition.sql (HISHAM/ONG/SHEN)
--   - 20260505_van_stock_2_vans_addition.sql (P.SIANG/SYUKRI)
-- After this migration: 13 technician vans seeded.
--
-- Source files: /home/jay/Downloads/<TECHNAME> <PLATE>.xlsx
--
-- Side-effect: tech1 placeholder rename. Pre-flight (2026-05-05 15:50)
-- found tech1 with full_name='Tech One' (legacy placeholder) and
-- name='kim' (partial rename done previously). Per Shin's roster pic
-- (WhatsApp 2026-05-05) and the precedent set by the 2026-04-24 SYUKRI
-- rename, both fields are normalized to 'LIM KIM HO' here, with a note
-- appended to users.notes capturing the previous values for audit.
-- The 43 assigned + 24 completed jobs against tech1's user_id are
-- preserved (FK is by user_id, which doesn't change).
--
-- Code resolution: 104 unique codes across both vans, ALL matched
-- parts.part_code directly (no fuzzy variants needed in this batch).
--
-- Liquid routing: trigger 'trg_route_liquid_to_bulk_quantity' (added in
-- 20260504_van_stock_liquid_routing_guard.sql) auto-routes liquid
-- 'quantity' values into 'bulk_quantity' at INSERT time. The migration
-- writes plain quantity; the trigger handles the rest.
--
-- Schema notes:
--   - van_stocks has UNIQUE(technician_id). Pre-flight verified both techs
--     have 0 van_stocks; inserts will not conflict.
--   - van_stock_items has UNIQUE(van_stock_id, part_id). No duplicate
--     codes within either xlsx (verified at parse time).
--   - max_items set to actual unique-code count per van.
--   - created_by set to admin1@example.com (Admin One) as the import actor.
--
-- Safety: single BEGIN/COMMIT with post-insert assertion.

BEGIN;

-- ============================================================================
-- Tech1 placeholder rename: 'Tech One' -> 'LIM KIM HO' per Shin's roster
-- ============================================================================
UPDATE users
   SET full_name = 'LIM KIM HO',
       name      = 'LIM KIM HO',
       notes     = TRIM(BOTH E'
' FROM
                     COALESCE(notes, '') ||
                     E'
[2026-05-05] Renamed from placeholder full_name=Tech One / name=kim to LIM KIM HO per Shin (roster image WhatsApp 2026-05-05). Same user_id; 43 assigned + 24 completed jobs preserved.'
                   ),
       updated_at = NOW()
 WHERE email = 'tech1@example.com'
   AND full_name = 'Tech One';

-- FADHIL: FADHIL VCS 6852.xlsx  plate=VCS 6852  items=70  (tech=3e50dde2-270d-45eb-9642-cb31f0321efc)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '3e50dde2-270d-45eb-9642-cb31f0321efc', 'VCS 6852', 70, 'active', true,
    '77a0f88d-2cc0-4874-8c29-a6c63656d191',
    'Admin One',
    'Initial stock imported from Shin''''s xlsx checklist (FADHIL VCS 6852.xlsx, checked 16.04.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 3::numeric),
  ('6324ea5d-c704-4595-ad78-33618a2a7d26'::uuid, 1::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 3::numeric),
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 2::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 10::numeric),
  ('387b307d-487f-4957-a23a-40277f1dae93'::uuid, 1::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 5::numeric),
  ('3248bdfa-28b6-4813-af38-0433a3e1864b'::uuid, 8::numeric),
  ('3f99c8b5-adbc-4878-a20c-de510afeac59'::uuid, 1::numeric),
  ('92f6daf1-8c72-46fa-9e0f-b1efaccb8741'::uuid, 2::numeric),
  ('0a3a33f8-700a-4e1e-aa42-ce7bed244eff'::uuid, 1::numeric),
  ('7f8a9cb4-0125-4b3d-8649-cbb85938fabf'::uuid, 1::numeric),
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 1::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 3::numeric),
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 2::numeric),
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 2::numeric),
  ('3396f0f2-dfaa-450d-bd28-8f1c8e518472'::uuid, 2::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 2::numeric),
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 3::numeric),
  ('c465ea24-6b3c-44f6-8356-f28a398d32c2'::uuid, 2::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 1::numeric),
  ('4df2297b-d2ea-4cff-8ed9-0ca2888edf39'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 13::numeric),
  ('97e5a705-5957-4a1f-9bd0-abc409d67137'::uuid, 1::numeric),
  ('3ef30178-617c-43e2-bd98-ee66bef1034b'::uuid, 1::numeric),
  ('3f53a558-0fd6-4eae-91c7-71ce55f9618a'::uuid, 1::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 4::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 5::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 2::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('96b3dd23-8c4d-4fac-9474-7a59d816b1b3'::uuid, 3::numeric),
  ('630b5ec1-da65-4b2c-a174-f7fb4e7d2386'::uuid, 2::numeric),
  ('643da154-7f6e-4af1-a2ff-6e819abcef11'::uuid, 1::numeric),
  ('db15b8dd-860d-48f9-aae8-8a4ed7155a40'::uuid, 2::numeric),
  ('61ff6109-5211-4b0a-8b28-82bb0bc4af7f'::uuid, 2::numeric),
  ('07bdea27-d38c-48d7-ae41-40f138bb407e'::uuid, 2::numeric),
  ('cc36564b-a002-40d0-a6f5-de79e6acc553'::uuid, 4::numeric),
  ('45ed7877-2e8b-4b00-b599-bd8a85ba4955'::uuid, 1::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 1::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 12::numeric),
  ('a3d79f70-018c-4692-84b6-ccbad60d658d'::uuid, 2::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 5::numeric),
  ('2fea7c16-b728-4b19-b44b-0202907bc88c'::uuid, 2::numeric),
  ('c3f4af5b-cc53-4789-b118-87e6c270d751'::uuid, 1::numeric),
  ('1d3a8d2c-2eb2-49ac-86e8-384babc606d7'::uuid, 1::numeric),
  ('860ae055-f5ee-464d-ac59-0f1ad7b7d11b'::uuid, 1::numeric),
  ('074c19db-2369-479b-becb-d31c11f0a864'::uuid, 1::numeric),
  ('37f6221d-4510-41df-8bf9-d0672ca8e4a6'::uuid, 1::numeric),
  ('4da96ff9-75c5-4a77-96f4-60eb9f96f15e'::uuid, 1::numeric),
  ('d2b81962-56f3-4024-a5a6-60c2f9a65c1e'::uuid, 1::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 45::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 2::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 18::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 2::numeric),
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 2::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 6::numeric),
  ('e166acf7-d008-440f-8f9d-8392d3a0dd7c'::uuid, 4::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 3::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 3::numeric),
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 1::numeric),
  ('5b074b27-0747-467a-843e-cd440148ff1a'::uuid, 1::numeric),
  ('13402805-34bd-4c0d-a083-b35ee1bc4e4f'::uuid, 1::numeric)
) AS v(part_id, quantity);

-- KIM: KIM BRM 6332.xlsx  plate=BRM 6332  items=61  (tech=9d81c05b-ce1a-4f0e-9530-cbb4e1c22ca2)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '9d81c05b-ce1a-4f0e-9530-cbb4e1c22ca2', 'BRM 6332', 61, 'active', true,
    '77a0f88d-2cc0-4874-8c29-a6c63656d191',
    'Admin One',
    'Initial stock imported from Shin''''s xlsx checklist (KIM BRM 6332.xlsx, checked 24.04.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 1::numeric),
  ('f0f07d79-fea3-4f34-be72-6b3adbe80771'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('8eb2bf70-d5a6-4d4c-8464-78aa10250a49'::uuid, 1::numeric),
  ('480fbc6c-1df7-4e95-a703-b19509efc0ab'::uuid, 1::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 10::numeric),
  ('94a7863f-fa4b-4642-ad77-eddfa98b8ff3'::uuid, 1::numeric),
  ('81d71c6d-dfbe-4c6e-ac0b-b33802312272'::uuid, 2::numeric),
  ('58592ee8-eb6a-428c-b6f3-511cb7f865a5'::uuid, 1::numeric),
  ('5c496209-808a-4679-85a0-ae2764fb357c'::uuid, 1::numeric),
  ('96f60ff4-f5b4-404b-95df-19376a6045c9'::uuid, 1::numeric),
  ('a1dbbfa1-5a15-4ba8-816a-99bf4f74be7f'::uuid, 2::numeric),
  ('5b7cea6c-04c4-470d-a8f7-4024d0cbc4e6'::uuid, 1::numeric),
  ('48336d65-466e-4803-bc6c-118ba2d3ea65'::uuid, 5::numeric),
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 16::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 4::numeric),
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 1::numeric),
  ('6dc75097-5642-4952-9274-339dfb66c577'::uuid, 1::numeric),
  ('503cede6-9097-47cd-81c5-b966893b0ccc'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 3::numeric),
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 3::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 8::numeric),
  ('97e5a705-5957-4a1f-9bd0-abc409d67137'::uuid, 1::numeric),
  ('22cce18d-d386-4eaa-b2c0-20f33c801c1f'::uuid, 1::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 1::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 3::numeric),
  ('2d8cf879-8c91-4665-80fe-827841114bdb'::uuid, 3::numeric),
  ('b00cf6f8-9583-40c9-87d7-b2e71f7fa4ea'::uuid, 3::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('96b3dd23-8c4d-4fac-9474-7a59d816b1b3'::uuid, 7::numeric),
  ('a8b54f58-4cd2-4a11-947c-2da185b39602'::uuid, 2::numeric),
  ('604b5542-169b-4033-a8f7-b0e2dfca2008'::uuid, 6::numeric),
  ('e255c1f2-0541-4549-af35-3ea44a707da7'::uuid, 6::numeric),
  ('adcfb074-650f-4e23-8198-4485d944b3b0'::uuid, 3::numeric),
  ('643da154-7f6e-4af1-a2ff-6e819abcef11'::uuid, 2::numeric),
  ('9017a3ae-2068-454d-8d07-8ebbf7d43eb9'::uuid, 2::numeric),
  ('eced3ac4-861a-479c-aa68-da04fa2d5cdb'::uuid, 2::numeric),
  ('57632184-e0d1-40c1-bb14-4d86baa1884b'::uuid, 1::numeric),
  ('86b14247-16d1-4cd0-b2b1-f07343b79f3e'::uuid, 6::numeric),
  ('94d9970f-09eb-430e-a220-e9edbb471fe7'::uuid, 4::numeric),
  ('6b6114c2-30fa-4d7d-8f92-e080ac8ef357'::uuid, 1::numeric),
  ('ba5ee4b4-6a93-4d0a-a89f-57fd13670fd1'::uuid, 1::numeric),
  ('07bdea27-d38c-48d7-ae41-40f138bb407e'::uuid, 6::numeric),
  ('d1b58d76-350a-4b5e-9542-2a054eaf4ce7'::uuid, 9::numeric),
  ('74d01f8c-ba5c-422f-bce2-56b54c4458de'::uuid, 5::numeric),
  ('117ebf1c-ba29-41dd-805b-96e5237ffd4b'::uuid, 1::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 5::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 10::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 8::numeric),
  ('074c19db-2369-479b-becb-d31c11f0a864'::uuid, 2::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 29::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 1::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 17::numeric),
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 8::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 5::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 1::numeric),
  ('387b9f5c-6219-423c-9f14-83a28a964daf'::uuid, 1::numeric),
  ('48998bc2-994f-4bd3-a9ce-58e175a920c6'::uuid, 1::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),
  ('cb238a4d-799a-4fa3-9e71-036093ab2494'::uuid, 5::numeric)
) AS v(part_id, quantity);

COMMIT;

-- ============================================
-- Post-apply verification
-- ============================================
DO $$
DECLARE
  v_van_count INTEGER;
  v_item_count INTEGER;
  v_kim_name TEXT;
BEGIN
  SELECT COUNT(*) INTO v_van_count FROM van_stocks
   WHERE van_plate IN ('VCS 6852', 'BRM 6332');
  IF v_van_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 new van_stocks rows, got %', v_van_count;
  END IF;

  SELECT COUNT(*) INTO v_item_count
    FROM van_stock_items i
    JOIN van_stocks v USING (van_stock_id)
    WHERE v.van_plate IN ('VCS 6852', 'BRM 6332');
  IF v_item_count <> 131 THEN
    RAISE EXCEPTION 'Expected 131 new van_stock_items, got %', v_item_count;
  END IF;

  SELECT full_name INTO v_kim_name FROM users WHERE email='tech1@example.com';
  IF v_kim_name <> 'LIM KIM HO' THEN
    RAISE EXCEPTION 'tech1 rename failed: full_name=%, expected LIM KIM HO', v_kim_name;
  END IF;

  RAISE NOTICE 'Van Stock 2-more-vans (KIM/FADHIL) migration applied: % vans, % items, tech1 renamed to %',
               v_van_count, v_item_count, v_kim_name;
END $$;
