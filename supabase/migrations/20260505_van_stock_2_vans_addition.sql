-- 20260505_van_stock_2_vans_addition.sql
--
-- Additional Van Stock data for 2 more technicians, from Shin's xlsx
-- checklists (Acwer Service Van Checklist) handed over 2026-05-05:
--   - P.SIANG (tech6)  plate BQU 8619 — checked 2026-04-28
--   - SYUKRI  (tech20) plate VLG 7223 — checked 2026-05-05
--
-- Source roster (Shin WhatsApp 2026-05-05): 'WhatsApp Image 2026-05-05 at
-- 12.20.59 AM.jpeg' — explicit van assignments for ACWER KOTA KEMUNING
-- highlighted P.SIANG=BQU 8619 and SYUKRI=VLG 7223. SYUKRI was the
-- outstanding tech20 stock noted in 2026-04-24 changelog as 'pending
-- separate stock sheet from client'.
--
-- Source files: /home/jay/Downloads/Ft/<TECHNAME> <PLATE>.xlsx
-- This is a follow-on to:
--   - 20260424_van_stock_6_vans_initial.sql (BASRI/BON/FIRDAUS/HAFIZ/HAN/HASRUL)
--   - 20260504_van_stock_3_vans_addition.sql (HISHAM/ONG/SHEN)
-- After this migration: 11 technician vans seeded.
--
-- Code resolution: 111 unique codes across both vans, ALL matched
-- parts.part_code directly (1 fuzzy variant for FUEL FILTER 1182 B):
--   '23303-64010 B' + desc 'FUEL FILTER 1182 @ NISSIN' -> '23303-64010B'
--   (occurs in P.SIANG and SYUKRI — same as prior migrations)
-- The 1182 vs 1182B split was clarified by Shin 2026-05-04 and the
-- catalog already has both rows correctly. Both xlsx files have the
-- two rows correctly separated, so no merge logic is needed here.
--
-- Liquid routing: trigger 'trg_route_liquid_to_bulk_quantity' (added in
-- 20260504_van_stock_liquid_routing_guard.sql) auto-routes the liquid
-- 'quantity' values below into 'bulk_quantity'. We pass quantity as the
-- xlsx says; the trigger is the single source of routing truth.
--
-- Schema notes:
--   - van_stocks has UNIQUE(technician_id). Pre-flight verified both techs
--     currently have 0 van_stocks (2026-05-05 09:00); inserts will not conflict.
--   - van_stock_items has UNIQUE(van_stock_id, part_id). No duplicate
--     codes within either xlsx (verified at parse time).
--   - max_items set to the actual unique-code count per van.
--   - created_by set to admin1@example.com (Admin One) as the import actor.
--
-- Safety: single BEGIN/COMMIT with post-insert assertion (2 new van_stocks +
-- expected item counts per van).

BEGIN;

-- P.SIANG: P.SIANG BQU 8619.xlsx  plate=BQU 8619  items=103  (tech=be42e721-38eb-4d83-b8bf-15fa6eb240dd)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    'be42e721-38eb-4d83-b8bf-15fa6eb240dd', 'BQU 8619', 103, 'active', true,
    '77a0f88d-2cc0-4874-8c29-a6c63656d191',
    'Admin One',
    'Initial stock imported from Shin''''s xlsx checklist (P.SIANG BQU 8619.xlsx, checked 28.04.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 2::numeric),
  ('e2c3380c-bdd6-499a-8301-bcf3bb83dc00'::uuid, 1::numeric),
  ('f0f07d79-fea3-4f34-be72-6b3adbe80771'::uuid, 1::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('b9c58cb3-5333-49bc-8319-3bba553b47bc'::uuid, 1::numeric),
  ('81751600-d08a-4743-a654-5a5b724dabeb'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 1::numeric),
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 1::numeric),
  ('13c1f811-96bc-4a61-b927-08cd28ba9008'::uuid, 2::numeric),
  ('7c96047f-6e25-4a2f-8e9a-fd86843ec568'::uuid, 1::numeric),
  ('d9bf0efe-8cfb-44a2-ac9b-c1b4766baa6e'::uuid, 1::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),
  ('480fbc6c-1df7-4e95-a703-b19509efc0ab'::uuid, 1::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 6::numeric),
  ('96430ee5-948e-4d4d-938f-0321071e7127'::uuid, 1::numeric),
  ('9630b19a-f44f-41f0-bed0-18cc90db0803'::uuid, 2::numeric),
  ('efa39bb1-a330-44a1-ada6-56e7a61c343a'::uuid, 6::numeric),
  ('81d71c6d-dfbe-4c6e-ac0b-b33802312272'::uuid, 4::numeric),
  ('e7541b7a-d649-4dc2-80f4-23290a4eedbd'::uuid, 1::numeric),
  ('162ac8ec-a1db-4aca-a629-e17546c4c2ee'::uuid, 5::numeric),
  ('e1c53926-e182-4860-8a3f-6c478f8ce7a3'::uuid, 1::numeric),
  ('a1dbbfa1-5a15-4ba8-816a-99bf4f74be7f'::uuid, 5::numeric),
  ('5e611713-13bd-48ed-999c-3958492e0301'::uuid, 1::numeric),
  ('773bd637-fa00-4a92-834f-e6f677d1dd2c'::uuid, 4::numeric),
  ('d8d6bd72-7130-4146-b8e2-39b36bd68681'::uuid, 2::numeric),
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 1::numeric),
  ('48336d65-466e-4803-bc6c-118ba2d3ea65'::uuid, 2::numeric),
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 4::numeric),
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 4::numeric),
  ('7f5378b2-3f21-4f8f-8050-3c979e5f078e'::uuid, 2::numeric),
  ('a63b034e-5227-45b5-9447-2599a86f7a1d'::uuid, 2::numeric),
  ('7276a1fd-4c8d-4b14-9b4e-056157a4b594'::uuid, 1::numeric),
  ('74c349f4-ca80-4011-8a5f-4f3849d9253b'::uuid, 2::numeric),
  ('85f7eeaf-8c9c-4040-9c5c-062a1efa5f19'::uuid, 1::numeric),
  ('e1360a82-9046-48f6-abf5-574bf8dbc145'::uuid, 1::numeric),
  ('b8ae64b3-44c8-4341-b96f-5b15a14e67b8'::uuid, 1::numeric),
  ('9ccd768f-9e28-44e1-931c-70652ab31678'::uuid, 3::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 4::numeric),
  ('2a51597f-76fc-4924-af73-0e3d74c0d156'::uuid, 3::numeric),
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 1::numeric),
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 1::numeric),
  ('3396f0f2-dfaa-450d-bd28-8f1c8e518472'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 2::numeric),
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 1::numeric),
  ('c465ea24-6b3c-44f6-8356-f28a398d32c2'::uuid, 2::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 2::numeric),
  ('a447be69-bc5c-4640-bfa4-c1ed4badbbcc'::uuid, 2::numeric),
  ('8d1bf918-6855-425c-96de-5f6e0e227a30'::uuid, 2::numeric),
  ('e2fc7595-fdd0-4227-bcbc-5d3165cc16f6'::uuid, 1::numeric),
  ('3b3b7906-e749-4428-9144-4320e671bb32'::uuid, 1::numeric),
  ('eb2e3bfc-b344-46e4-b17b-c642830d18a0'::uuid, 1::numeric),
  ('cca10a68-05bf-4f25-9755-6f74d84c8bd0'::uuid, 1::numeric),
  ('4df2297b-d2ea-4cff-8ed9-0ca2888edf39'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 6::numeric),
  ('630b5ec1-da65-4b2c-a174-f7fb4e7d2386'::uuid, 1::numeric),
  ('675b0e9e-ee00-4c4a-b4eb-c8548422c0a5'::uuid, 2::numeric),
  ('22cce18d-d386-4eaa-b2c0-20f33c801c1f'::uuid, 1::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('96b3dd23-8c4d-4fac-9474-7a59d816b1b3'::uuid, 3::numeric),
  ('604b5542-169b-4033-a8f7-b0e2dfca2008'::uuid, 1::numeric),
  ('8d510242-ee96-4c86-a179-0c5b0ab747b2'::uuid, 1::numeric),
  ('e255c1f2-0541-4549-af35-3ea44a707da7'::uuid, 2::numeric),
  ('643da154-7f6e-4af1-a2ff-6e819abcef11'::uuid, 1::numeric),
  ('57632184-e0d1-40c1-bb14-4d86baa1884b'::uuid, 2::numeric),
  ('9f1f27c0-5c65-42e7-8b0f-ae6d60e7573d'::uuid, 1::numeric),
  ('4f7f9e02-f794-4412-874b-4785be993a5f'::uuid, 2::numeric),
  ('495d4186-0852-46d2-a937-ed77ddc47223'::uuid, 4::numeric),
  ('915cc548-87c8-45ef-b290-b016995daa1f'::uuid, 1::numeric),
  ('86b14247-16d1-4cd0-b2b1-f07343b79f3e'::uuid, 2::numeric),
  ('74d01f8c-ba5c-422f-bce2-56b54c4458de'::uuid, 4::numeric),
  ('94d9970f-09eb-430e-a220-e9edbb471fe7'::uuid, 1::numeric),
  ('d1b58d76-350a-4b5e-9542-2a054eaf4ce7'::uuid, 2::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 1::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 2::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 8::numeric),
  ('033f3c4a-d599-47c2-bbb0-ca1b31a058d7'::uuid, 1::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 2::numeric),
  ('5116d532-ae65-4398-b4c3-ed9a3e9cf76d'::uuid, 2::numeric),
  ('a3f96147-02b9-4072-b51b-eb525747418a'::uuid, 1::numeric),
  ('b6b4e2e9-e08f-4895-9c1e-b70d8c85a59f'::uuid, 3::numeric),
  ('1c76b403-c9de-4884-88ea-4f9fe3a9255c'::uuid, 2::numeric),
  ('f0676d75-cb33-4c0b-857a-a7ec737211ac'::uuid, 1::numeric),
  ('9c5861b7-d116-4d29-9536-80d2d16d60ac'::uuid, 1::numeric),
  ('4da96ff9-75c5-4a77-96f4-60eb9f96f15e'::uuid, 1::numeric),
  ('d2b81962-56f3-4024-a5a6-60c2f9a65c1e'::uuid, 1::numeric),
  ('17452f17-ec99-451d-a730-0ee3f4d9a7cf'::uuid, 1::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 20::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 4::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 20::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 4::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 6::numeric),
  ('9bf100fe-54be-4b7b-8559-d8bc7fc2ff2e'::uuid, 1::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 2::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 1::numeric),
  ('84ea055d-5b97-45d8-b3c2-09d4cebff5ab'::uuid, 2::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),
  ('cb238a4d-799a-4fa3-9e71-036093ab2494'::uuid, 3::numeric),
  ('790a87fe-ebf0-4a29-adf1-c4f47d53aab1'::uuid, 1::numeric),
  ('a85ead3e-9af6-4470-97bd-b282ec84e37d'::uuid, 1::numeric)
) AS v(part_id, quantity);

-- SYUKRI: SYUKRI VLG 7223.xlsx  plate=VLG 7223  items=32  (tech=e97ec210-d470-49c1-8121-a87c1829cb3c)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    'e97ec210-d470-49c1-8121-a87c1829cb3c', 'VLG 7223', 32, 'active', true,
    '77a0f88d-2cc0-4874-8c29-a6c63656d191',
    'Admin One',
    'Initial stock imported from Shin''''s xlsx checklist (SYUKRI VLG 7223.xlsx, checked 05.05.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 1::numeric),
  ('6fa4297c-039d-4e07-811f-196f3bf9c885'::uuid, 1::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 12::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 12::numeric),
  ('96430ee5-948e-4d4d-938f-0321071e7127'::uuid, 1::numeric),
  ('53191897-d0c0-443f-b759-bf27be13df75'::uuid, 1::numeric),
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 1::numeric),
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 6::numeric),
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 1::numeric),
  ('3676e3db-30e3-49ee-8efd-d3d2f938a3e5'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 10::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 4::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('643da154-7f6e-4af1-a2ff-6e819abcef11'::uuid, 1::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 3::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 1::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 11::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 40::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 6::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 30::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 7::numeric),
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 4::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 3::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 3::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric)
) AS v(part_id, quantity);

COMMIT;

-- ============================================
-- Post-apply verification
-- ============================================
DO $$
DECLARE
  van_count INTEGER;
  item_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO van_count FROM van_stocks
   WHERE van_plate IN ('BQU 8619', 'VLG 7223');
  IF van_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 new van_stocks rows, got %', van_count;
  END IF;

  SELECT COUNT(*) INTO item_count
    FROM van_stock_items i
    JOIN van_stocks v USING (van_stock_id)
    WHERE v.van_plate IN ('BQU 8619', 'VLG 7223');
  IF item_count <> 135 THEN
    RAISE EXCEPTION 'Expected 135 new van_stock_items, got %', item_count;
  END IF;

  RAISE NOTICE 'Van Stock 2-vans-addition migration applied: % vans, % items', van_count, item_count;
END $$;
