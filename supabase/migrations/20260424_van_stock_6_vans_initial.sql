-- 20260424_van_stock_6_vans_initial.sql
--
-- Initial Van Stock data for 6 technicians, from Shin's xlsx checklists
-- (Acwer Service Van Checklist) handed over 2026-04-23:
--   - BASRI   (tech17) plate VEW 9631  — 104 items (checked 2026-04-14)
--   - BON     (tech5)  plate VEW8236   —  59 items (checked 2026-04-13)
--   - FIRDAUS (tech18) plate FA 9238   —  81 items (checked 2026-04-17)
--   - HAFIZ   (tech15) plate VFG 7238  —  73 items (checked 2026-04-20)
--   - HAN     (tech10) plate MDT 6631  —  89 items (checked 2026-04-21)
--   - HASRUL  (tech14) plate BNX 8936  —  75 items (checked 2026-04-22)
--
-- Source files: /home/jay/Downloads/Ft/<TECHNAME> <PLATE>.xlsx
-- Code->part_id reconciliation: 185/188 matched parts.part_code directly;
-- 3 transcription variants fuzzy-matched:
--   "23303-64010 B" + desc "1182B" -> 23303-64010B
--   "23303-64010 B" + desc "1182"  -> 23303-64010
--   "1191-76001"  -> 11191-76001  (missing leading 1)
--   "LW-C-85X70/75X25" -> LW-C-85x70/75x25  (case drift)
--
-- Schema notes:
--   - van_stocks has UNIQUE(technician_id). Each of these 6 techs currently has
--     0 van_stocks (confirmed via pre-insert probe); inserts will not conflict.
--   - van_stock_items: populating quantity only. container_quantity/bulk_quantity
--     default to 0 — matches the non-liquid historical pattern. Liquid line items
--     (21 across the 6 vans) also get quantity only; admins can adjust the
--     container breakdown via the UI if needed.
--   - max_items set to the actual item count per van (ceil), replacing the
--     default 50 which would be blown through for BASRI/HAN/FIRDAUS.
--   - created_by set to admin1@example.com (Admin One) as the import actor.
--
-- Safety: single BEGIN/COMMIT with post-insert assertion (6 van_stocks, correct
-- item count per van).

BEGIN;

-- BASRI: BASRI VEW 9631.xlsx  plate=VEW 9631  items=102  (tech=tech17@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    'b08b2889-0209-4295-96b9-7e4e65d93036', 'VEW 9631', 102, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (BASRI VEW 9631.xlsx, checked 14.04.2026).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 1::numeric),
  ('d695560f-e10a-4c27-ace0-35ccedd425ea'::uuid, 1::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('b9c58cb3-5333-49bc-8319-3bba553b47bc'::uuid, 1::numeric),
  ('14471ce4-d82c-4542-92ec-63412d5599cd'::uuid, 1::numeric),
  ('6324ea5d-c704-4595-ad78-33618a2a7d26'::uuid, 1::numeric),
  ('cac8c51f-8f1f-474c-adb7-76f2418b391c'::uuid, 2::numeric),
  ('6fa4297c-039d-4e07-811f-196f3bf9c885'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 1::numeric),
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 1::numeric),
  ('387b307d-487f-4957-a23a-40277f1dae93'::uuid, 2::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 1::numeric),
  ('d033ef58-387a-435e-b415-525deda7ffaf'::uuid, 1::numeric),
  ('81751600-d08a-4743-a654-5a5b724dabeb'::uuid, 1::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 5::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 6::numeric),
  ('9630b19a-f44f-41f0-bed0-18cc90db0803'::uuid, 1::numeric),
  ('efa39bb1-a330-44a1-ada6-56e7a61c343a'::uuid, 1::numeric),
  ('2e5d4608-e858-482b-a2cb-2f98e980d7cf'::uuid, 3::numeric),
  ('92f6daf1-8c72-46fa-9e0f-b1efaccb8741'::uuid, 4::numeric),
  ('1301f9bd-95ce-40ae-8cab-ee4a54d85a2c'::uuid, 4::numeric),
  ('0a3a33f8-700a-4e1e-aa42-ce7bed244eff'::uuid, 1::numeric),
  ('162ac8ec-a1db-4aca-a629-e17546c4c2ee'::uuid, 4::numeric),
  ('773bd637-fa00-4a92-834f-e6f677d1dd2c'::uuid, 2::numeric),
  ('7f8a9cb4-0125-4b3d-8649-cbb85938fabf'::uuid, 1::numeric),
  ('4e499c32-0399-4728-82db-09bbab0134ae'::uuid, 1::numeric),
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 1::numeric),
  ('095f247d-e67d-4afd-b81d-5bd1fe0b6d9b'::uuid, 1::numeric),
  ('f45194c2-cb02-482a-bb07-0e7f4e15ad5b'::uuid, 2::numeric),
  ('74c349f4-ca80-4011-8a5f-4f3849d9253b'::uuid, 2::numeric),
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 2::numeric),
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 2::numeric),
  ('2a51597f-76fc-4924-af73-0e3d74c0d156'::uuid, 1::numeric),
  ('8d1bf918-6855-425c-96de-5f6e0e227a30'::uuid, 1::numeric),
  ('de5f7ff4-bc26-4e40-9827-fd5225425248'::uuid, 1::numeric),
  ('cca10a68-05bf-4f25-9755-6f74d84c8bd0'::uuid, 1::numeric),
  ('eb2e3bfc-b344-46e4-b17b-c642830d18a0'::uuid, 1::numeric),
  ('3b3b7906-e749-4428-9144-4320e671bb32'::uuid, 1::numeric),
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 1::numeric),
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 2::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 5::numeric),
  ('3396f0f2-dfaa-450d-bd28-8f1c8e518472'::uuid, 1::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 1::numeric),
  ('3004f59a-4eec-436e-8c1f-b03b1f4008d5'::uuid, 1::numeric),
  ('0c479758-b730-4b93-b541-bfa4fa1ece88'::uuid, 1::numeric),
  ('9bcb5001-cdbe-41f4-be9e-5a2b5124efc8'::uuid, 1::numeric),
  ('5dc6d365-d804-4275-86f0-e072ee7578d4'::uuid, 1::numeric),
  ('e0934fdb-8bdd-4e17-9dff-60fd14e332d7'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 20::numeric),
  ('0c58aac2-0ad3-4224-a2dd-27d0ca2e3201'::uuid, 1::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 4::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 9::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('675b0e9e-ee00-4c4a-b4eb-c8548422c0a5'::uuid, 2::numeric),
  ('630b5ec1-da65-4b2c-a174-f7fb4e7d2386'::uuid, 2::numeric),
  ('8d510242-ee96-4c86-a179-0c5b0ab747b2'::uuid, 1::numeric),
  ('6c536ea3-83b9-41e9-9c36-cbb2ad0fff1e'::uuid, 1::numeric),
  ('57632184-e0d1-40c1-bb14-4d86baa1884b'::uuid, 1::numeric),
  ('cc2f679a-ea5b-4763-be0d-af0588f378d8'::uuid, 3::numeric),
  ('117ebf1c-ba29-41dd-805b-96e5237ffd4b'::uuid, 2::numeric),
  ('07bdea27-d38c-48d7-ae41-40f138bb407e'::uuid, 5::numeric),
  ('74d01f8c-ba5c-422f-bce2-56b54c4458de'::uuid, 7::numeric),
  ('d1b58d76-350a-4b5e-9542-2a054eaf4ce7'::uuid, 4::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 1::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 2::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 4::numeric),
  ('a3d79f70-018c-4692-84b6-ccbad60d658d'::uuid, 1::numeric),
  ('033f3c4a-d599-47c2-bbb0-ca1b31a058d7'::uuid, 1::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 5::numeric),
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),
  ('b5675fac-1fa1-41d7-862c-796ee6e0e311'::uuid, 1::numeric),
  ('03849021-ed11-4d8c-9126-a0d2053f54ba'::uuid, 2::numeric),
  ('1c76b403-c9de-4884-88ea-4f9fe3a9255c'::uuid, 5::numeric),
  ('b6b4e2e9-e08f-4895-9c1e-b70d8c85a59f'::uuid, 3::numeric),
  ('99b58d91-a6c8-434c-ba76-5e9efe7c7873'::uuid, 1::numeric),
  ('1d3a8d2c-2eb2-49ac-86e8-384babc606d7'::uuid, 1::numeric),
  ('860ae055-f5ee-464d-ac59-0f1ad7b7d11b'::uuid, 2::numeric),
  ('074c19db-2369-479b-becb-d31c11f0a864'::uuid, 1::numeric),
  ('37f6221d-4510-41df-8bf9-d0672ca8e4a6'::uuid, 1::numeric),
  ('9c5861b7-d116-4d29-9536-80d2d16d60ac'::uuid, 1::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 32::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 6::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 25::numeric),
  ('f3061f92-2632-4070-b38f-98e50f837d89'::uuid, 1::numeric),
  ('e55acac3-e280-4b9e-9381-3c3c38a9c09f'::uuid, 1::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 6::numeric),
  ('866f727f-7b83-40cd-ae89-b9869720ce83'::uuid, 4::numeric),
  ('e166acf7-d008-440f-8f9d-8392d3a0dd7c'::uuid, 4::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 2::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 1::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 4::numeric),
  ('5b074b27-0747-467a-843e-cd440148ff1a'::uuid, 1::numeric),
  ('13402805-34bd-4c0d-a083-b35ee1bc4e4f'::uuid, 1::numeric)
) AS v(part_id, quantity);

-- BON: BON VEW8236.xlsx  plate=VEW8236  items=58  (tech=tech5@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '646a70cb-a177-4d30-becf-46804fb1f079', 'VEW8236', 58, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (BON VEW8236.xlsx, checked 13.04.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('e2c3380c-bdd6-499a-8301-bcf3bb83dc00'::uuid, 1::numeric),
  ('81751600-d08a-4743-a654-5a5b724dabeb'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 1::numeric),
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 2::numeric),
  ('13c1f811-96bc-4a61-b927-08cd28ba9008'::uuid, 2::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 1::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 10::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 10::numeric),
  ('162ac8ec-a1db-4aca-a629-e17546c4c2ee'::uuid, 4::numeric),
  ('a1dbbfa1-5a15-4ba8-816a-99bf4f74be7f'::uuid, 4::numeric),
  ('d8d6bd72-7130-4146-b8e2-39b36bd68681'::uuid, 4::numeric),
  ('8bb4bfda-5137-461e-99a2-3879cf645adf'::uuid, 2::numeric),
  ('5e611713-13bd-48ed-999c-3958492e0301'::uuid, 2::numeric),
  ('773bd637-fa00-4a92-834f-e6f677d1dd2c'::uuid, 4::numeric),
  ('28d1d13f-c874-4cb3-8883-497549817d16'::uuid, 4::numeric),
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 4::numeric),
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 1::numeric),
  ('de5f7ff4-bc26-4e40-9827-fd5225425248'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 3::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 2::numeric),
  ('4df2297b-d2ea-4cff-8ed9-0ca2888edf39'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 6::numeric),
  ('3ef30178-617c-43e2-bd98-ee66bef1034b'::uuid, 1::numeric),
  ('984c9613-5b2a-4a6e-98b1-e74abc9a17bc'::uuid, 1::numeric),
  ('675b0e9e-ee00-4c4a-b4eb-c8548422c0a5'::uuid, 2::numeric),
  ('630b5ec1-da65-4b2c-a174-f7fb4e7d2386'::uuid, 2::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 8::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 6::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('b9dfede6-0374-4e22-8b7f-22b2012f92da'::uuid, 1::numeric),
  ('8d510242-ee96-4c86-a179-0c5b0ab747b2'::uuid, 1::numeric),
  ('643da154-7f6e-4af1-a2ff-6e819abcef11'::uuid, 2::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 2::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 2::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 6::numeric),
  ('ca8cc4e6-58c9-4daf-8ba0-d7b2518e5a94'::uuid, 2::numeric),
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),
  ('4da96ff9-75c5-4a77-96f4-60eb9f96f15e'::uuid, 1::numeric),
  ('d2b81962-56f3-4024-a5a6-60c2f9a65c1e'::uuid, 1::numeric),
  ('1d3a8d2c-2eb2-49ac-86e8-384babc606d7'::uuid, 1::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 20::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 4::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 10::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 10::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 2::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 1::numeric),
  ('5b074b27-0747-467a-843e-cd440148ff1a'::uuid, 1::numeric),
  ('13402805-34bd-4c0d-a083-b35ee1bc4e4f'::uuid, 1::numeric)
) AS v(part_id, quantity);

-- FIRDAUS: FIRDAUS FA 9238.xlsx  plate=FA 9238  items=80  (tech=tech18@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    'b944a683-46fc-4dfd-a9fd-05067545e795', 'FA 9238', 80, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (FIRDAUS FA 9238.xlsx, checked 17.04.2026).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 2::numeric),
  ('f0f07d79-fea3-4f34-be72-6b3adbe80771'::uuid, 1::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('5b3ff89b-aa37-43e4-b732-3008538cc11e'::uuid, 2::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 2::numeric),
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 1::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 1::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 8::numeric),
  ('a1dbbfa1-5a15-4ba8-816a-99bf4f74be7f'::uuid, 2::numeric),
  ('8bb4bfda-5137-461e-99a2-3879cf645adf'::uuid, 5::numeric),
  ('d8d6bd72-7130-4146-b8e2-39b36bd68681'::uuid, 4::numeric),
  ('0a3a33f8-700a-4e1e-aa42-ce7bed244eff'::uuid, 1::numeric),
  ('b116fa1d-7bce-4d28-9762-b41fd0ac86bb'::uuid, 4::numeric),
  ('5e611713-13bd-48ed-999c-3958492e0301'::uuid, 4::numeric),
  ('773bd637-fa00-4a92-834f-e6f677d1dd2c'::uuid, 10::numeric),
  ('28d1d13f-c874-4cb3-8883-497549817d16'::uuid, 4::numeric),
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 3::numeric),
  ('7f8a9cb4-0125-4b3d-8649-cbb85938fabf'::uuid, 1::numeric),
  ('4e499c32-0399-4728-82db-09bbab0134ae'::uuid, 1::numeric),
  ('3f99c8b5-adbc-4878-a20c-de510afeac59'::uuid, 1::numeric),
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 2::numeric),
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 4::numeric),
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 4::numeric),
  ('9bfec9cb-368f-47bf-8ee5-1cad059ddfb4'::uuid, 2::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 1::numeric),
  ('6716576e-36c5-4ef7-b3b5-4cc3419e2c0c'::uuid, 1::numeric),
  ('e1360a82-9046-48f6-abf5-574bf8dbc145'::uuid, 3::numeric),
  ('3396f0f2-dfaa-450d-bd28-8f1c8e518472'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 8::numeric),
  ('e2fc7595-fdd0-4227-bcbc-5d3165cc16f6'::uuid, 4::numeric),
  ('5dc6d365-d804-4275-86f0-e072ee7578d4'::uuid, 1::numeric),
  ('a447be69-bc5c-4640-bfa4-c1ed4badbbcc'::uuid, 1::numeric),
  ('3f53a558-0fd6-4eae-91c7-71ce55f9618a'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 10::numeric),
  ('3ef30178-617c-43e2-bd98-ee66bef1034b'::uuid, 1::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 2::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 9::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('96b3dd23-8c4d-4fac-9474-7a59d816b1b3'::uuid, 2::numeric),
  ('dea7b11e-9e50-4ba6-b8dc-a8688004cc74'::uuid, 2::numeric),
  ('604b5542-169b-4033-a8f7-b0e2dfca2008'::uuid, 1::numeric),
  ('4542c343-24a3-4566-bca1-1cb0efb6c4b8'::uuid, 1::numeric),
  ('c9e8ed69-0e71-43a5-8dd8-ff7346ed3a53'::uuid, 1::numeric),
  ('643da154-7f6e-4af1-a2ff-6e819abcef11'::uuid, 2::numeric),
  ('86b14247-16d1-4cd0-b2b1-f07343b79f3e'::uuid, 4::numeric),
  ('adcfb074-650f-4e23-8198-4485d944b3b0'::uuid, 2::numeric),
  ('e255c1f2-0541-4549-af35-3ea44a707da7'::uuid, 2::numeric),
  ('d1b58d76-350a-4b5e-9542-2a054eaf4ce7'::uuid, 2::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 3::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 4::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 13::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 8::numeric),
  ('40a52ce6-9c44-47a2-b616-3cc1eaf291ef'::uuid, 1::numeric),
  ('2fea7c16-b728-4b19-b44b-0202907bc88c'::uuid, 1::numeric),
  ('6bb16593-dcb3-4786-aaf2-ca9cd8902640'::uuid, 1::numeric),
  ('1c76b403-c9de-4884-88ea-4f9fe3a9255c'::uuid, 11::numeric),
  ('b6b4e2e9-e08f-4895-9c1e-b70d8c85a59f'::uuid, 5::numeric),
  ('e3bccef0-7fc7-4d42-aa83-e53494c3c391'::uuid, 1::numeric),
  ('67fae248-b0a0-42e9-bc56-974b6f9382ac'::uuid, 2::numeric),
  ('49f8a4d3-e3c0-46ed-bd33-ef638867087b'::uuid, 2::numeric),
  ('99b58d91-a6c8-434c-ba76-5e9efe7c7873'::uuid, 1::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 18::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 8::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 20::numeric),
  ('65972951-8907-437d-b90a-26cc93ee3cdf'::uuid, 1::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 8::numeric),
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 2::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 8::numeric),
  ('2bd9491b-6898-48d8-8c86-4d66d078abc9'::uuid, 1::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 1::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 1::numeric),
  ('5b074b27-0747-467a-843e-cd440148ff1a'::uuid, 1::numeric),
  ('13402805-34bd-4c0d-a083-b35ee1bc4e4f'::uuid, 1::numeric)
) AS v(part_id, quantity);

-- HAFIZ: HAFIZ VFG 7238.xlsx  plate=VFG 7238  items=72  (tech=tech15@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    'e5685686-5ce8-47dd-954c-eb03ebb644bb', 'VFG 7238', 72, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (HAFIZ VFG 7238.xlsx, checked 20.04.2026).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 3::numeric),
  ('6fa4297c-039d-4e07-811f-196f3bf9c885'::uuid, 1::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('81751600-d08a-4743-a654-5a5b724dabeb'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('d9bf0efe-8cfb-44a2-ac9b-c1b4766baa6e'::uuid, 1::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 10::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 1::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 10::numeric),
  ('96430ee5-948e-4d4d-938f-0321071e7127'::uuid, 1::numeric),
  ('53191897-d0c0-443f-b759-bf27be13df75'::uuid, 2::numeric),
  ('92f6daf1-8c72-46fa-9e0f-b1efaccb8741'::uuid, 1::numeric),
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 4::numeric),
  ('7f8a9cb4-0125-4b3d-8649-cbb85938fabf'::uuid, 1::numeric),
  ('4e499c32-0399-4728-82db-09bbab0134ae'::uuid, 2::numeric),
  ('095f247d-e67d-4afd-b81d-5bd1fe0b6d9b'::uuid, 1::numeric),
  ('9e467435-1326-467d-a1d8-410786ca30af'::uuid, 1::numeric),
  ('e8e49d42-f7fa-44e5-b5ba-3f643337f7a6'::uuid, 1::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 2::numeric),
  ('de5f7ff4-bc26-4e40-9827-fd5225425248'::uuid, 1::numeric),
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 1::numeric),
  ('3396f0f2-dfaa-450d-bd28-8f1c8e518472'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 6::numeric),
  ('4df2297b-d2ea-4cff-8ed9-0ca2888edf39'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 26::numeric),
  ('984c9613-5b2a-4a6e-98b1-e74abc9a17bc'::uuid, 1::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 2::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 8::numeric),
  ('675b0e9e-ee00-4c4a-b4eb-c8548422c0a5'::uuid, 2::numeric),
  ('8068d52c-7a28-4901-a91c-c31f50f1e432'::uuid, 1::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 2::numeric),
  ('0750c8ff-e8ed-4b19-b36b-c95566bfed80'::uuid, 1::numeric),
  ('dea7b11e-9e50-4ba6-b8dc-a8688004cc74'::uuid, 6::numeric),
  ('630b5ec1-da65-4b2c-a174-f7fb4e7d2386'::uuid, 4::numeric),
  ('643da154-7f6e-4af1-a2ff-6e819abcef11'::uuid, 1::numeric),
  ('94d9970f-09eb-430e-a220-e9edbb471fe7'::uuid, 1::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 2::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 1::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 10::numeric),
  ('a3d79f70-018c-4692-84b6-ccbad60d658d'::uuid, 2::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 4::numeric),
  ('1b7ebe59-bab7-4702-9af0-9378d95a0f06'::uuid, 1::numeric),
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),
  ('b5675fac-1fa1-41d7-862c-796ee6e0e311'::uuid, 2::numeric),
  ('03849021-ed11-4d8c-9126-a0d2053f54ba'::uuid, 4::numeric),
  ('206be2c9-bc63-4897-be56-d04d013b80dd'::uuid, 2::numeric),
  ('d890667b-9869-44a2-bf6e-9329077b7d73'::uuid, 1::numeric),
  ('2fea7c16-b728-4b19-b44b-0202907bc88c'::uuid, 1::numeric),
  ('6bb16593-dcb3-4786-aaf2-ca9cd8902640'::uuid, 2::numeric),
  ('1d3a8d2c-2eb2-49ac-86e8-384babc606d7'::uuid, 1::numeric),
  ('99b58d91-a6c8-434c-ba76-5e9efe7c7873'::uuid, 1::numeric),
  ('b6b4e2e9-e08f-4895-9c1e-b70d8c85a59f'::uuid, 2::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 32::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 8::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 20::numeric),
  ('65972951-8907-437d-b90a-26cc93ee3cdf'::uuid, 1::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 7::numeric),
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 3::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 5::numeric),
  ('cb238a4d-799a-4fa3-9e71-036093ab2494'::uuid, 2::numeric),
  ('e166acf7-d008-440f-8f9d-8392d3a0dd7c'::uuid, 3::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 1::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 2::numeric),
  ('5b074b27-0747-467a-843e-cd440148ff1a'::uuid, 1::numeric),
  ('13402805-34bd-4c0d-a083-b35ee1bc4e4f'::uuid, 1::numeric)
) AS v(part_id, quantity);

-- HAN: HAN MDT 6631.xlsx  plate=MDT 6631  items=89  (tech=tech10@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    'd6c28c72-7a50-4ca4-86c2-4125fbcb5788', 'MDT 6631', 89, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (HAN MDT 6631.xlsx, checked 21.04.2026).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 1::numeric),
  ('e2c3380c-bdd6-499a-8301-bcf3bb83dc00'::uuid, 1::numeric),
  ('f0f07d79-fea3-4f34-be72-6b3adbe80771'::uuid, 1::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('b9c58cb3-5333-49bc-8319-3bba553b47bc'::uuid, 1::numeric),
  ('83625ad9-2f9d-4e45-945d-a78dc9a3e53b'::uuid, 1::numeric),
  ('ccc9f118-204d-45bf-8f60-1365f9779eee'::uuid, 1::numeric),
  ('6324ea5d-c704-4595-ad78-33618a2a7d26'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 1::numeric),
  ('af7625db-14f3-40f7-8580-eacbda15d623'::uuid, 2::numeric),
  ('387b307d-487f-4957-a23a-40277f1dae93'::uuid, 2::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 2::numeric),
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 2::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 12::numeric),
  ('153359ab-ea56-411e-8e86-ba09b153062b'::uuid, 2::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 11::numeric),
  ('36769f9f-9d03-4b04-aaa4-644e80fd352a'::uuid, 1::numeric),
  ('bdc5bcdf-dc06-4146-8dd1-2a561f4e33fe'::uuid, 1::numeric),
  ('3f99c8b5-adbc-4878-a20c-de510afeac59'::uuid, 1::numeric),
  ('9e467435-1326-467d-a1d8-410786ca30af'::uuid, 1::numeric),
  ('8bb4bfda-5137-461e-99a2-3879cf645adf'::uuid, 2::numeric),
  ('a1dbbfa1-5a15-4ba8-816a-99bf4f74be7f'::uuid, 2::numeric),
  ('0a3a33f8-700a-4e1e-aa42-ce7bed244eff'::uuid, 1::numeric),
  ('5e611713-13bd-48ed-999c-3958492e0301'::uuid, 4::numeric),
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 11::numeric),
  ('7f8a9cb4-0125-4b3d-8649-cbb85938fabf'::uuid, 2::numeric),
  ('4e499c32-0399-4728-82db-09bbab0134ae'::uuid, 2::numeric),
  ('095f247d-e67d-4afd-b81d-5bd1fe0b6d9b'::uuid, 1::numeric),
  ('48336d65-466e-4803-bc6c-118ba2d3ea65'::uuid, 1::numeric),
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 8::numeric),
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 2::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 4::numeric),
  ('e8e49d42-f7fa-44e5-b5ba-3f643337f7a6'::uuid, 1::numeric),
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 1::numeric),
  ('e1360a82-9046-48f6-abf5-574bf8dbc145'::uuid, 2::numeric),
  ('0eca73ce-26ab-45df-bba8-c032f036f2b7'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 4::numeric),
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 3::numeric),
  ('e2fc7595-fdd0-4227-bcbc-5d3165cc16f6'::uuid, 1::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 1::numeric),
  ('8d1bf918-6855-425c-96de-5f6e0e227a30'::uuid, 1::numeric),
  ('3f53a558-0fd6-4eae-91c7-71ce55f9618a'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 10::numeric),
  ('984c9613-5b2a-4a6e-98b1-e74abc9a17bc'::uuid, 1::numeric),
  ('2d8cf879-8c91-4665-80fe-827841114bdb'::uuid, 2::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 4::numeric),
  ('0750c8ff-e8ed-4b19-b36b-c95566bfed80'::uuid, 1::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('96b3dd23-8c4d-4fac-9474-7a59d816b1b3'::uuid, 6::numeric),
  ('dea7b11e-9e50-4ba6-b8dc-a8688004cc74'::uuid, 1::numeric),
  ('604b5542-169b-4033-a8f7-b0e2dfca2008'::uuid, 2::numeric),
  ('c9e8ed69-0e71-43a5-8dd8-ff7346ed3a53'::uuid, 1::numeric),
  ('6b6114c2-30fa-4d7d-8f92-e080ac8ef357'::uuid, 1::numeric),
  ('e255c1f2-0541-4549-af35-3ea44a707da7'::uuid, 2::numeric),
  ('e42c47e7-66fd-4a2f-9ed3-5e5af4ad8dc9'::uuid, 1::numeric),
  ('86b14247-16d1-4cd0-b2b1-f07343b79f3e'::uuid, 4::numeric),
  ('45ed7877-2e8b-4b00-b599-bd8a85ba4955'::uuid, 2::numeric),
  ('74d01f8c-ba5c-422f-bce2-56b54c4458de'::uuid, 3::numeric),
  ('cc2f679a-ea5b-4763-be0d-af0588f378d8'::uuid, 2::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 1::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 1::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 9::numeric),
  ('a3d79f70-018c-4692-84b6-ccbad60d658d'::uuid, 1::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 16::numeric),
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),
  ('03849021-ed11-4d8c-9126-a0d2053f54ba'::uuid, 1::numeric),
  ('6bb16593-dcb3-4786-aaf2-ca9cd8902640'::uuid, 1::numeric),
  ('9a975ef4-01bb-45fc-b206-9604a7b3f2e2'::uuid, 1::numeric),
  ('1d3a8d2c-2eb2-49ac-86e8-384babc606d7'::uuid, 1::numeric),
  ('b6b4e2e9-e08f-4895-9c1e-b70d8c85a59f'::uuid, 5::numeric),
  ('e3bccef0-7fc7-4d42-aa83-e53494c3c391'::uuid, 1::numeric),
  ('67fae248-b0a0-42e9-bc56-974b6f9382ac'::uuid, 1::numeric),
  ('4661dcdd-3cb1-4acc-98c0-0a2c99a303af'::uuid, 1::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 18::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 2::numeric),
  ('7d404449-6d61-426c-91d5-303ba794fc75'::uuid, 1::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 5::numeric),
  ('e166acf7-d008-440f-8f9d-8392d3a0dd7c'::uuid, 4::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 2::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),
  ('dc3524c5-a12e-4d2e-af20-8101e4c02f26'::uuid, 1::numeric),
  ('a7317155-90f0-427e-bb0b-ae7ff9ae616d'::uuid, 1::numeric),
  ('ad5faa07-bd78-4b28-b76c-8fb26ffb6de4'::uuid, 2::numeric)
) AS v(part_id, quantity);

-- HASRUL: HASRUL BNX 8936.xlsx  plate=BNX8936  items=74  (tech=tech14@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '5d86aad7-c8b7-45c9-8096-5f985b437e11', 'BNX8936', 74, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (HASRUL BNX 8936.xlsx, checked 22.04.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('cac8c51f-8f1f-474c-adb7-76f2418b391c'::uuid, 3::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('83625ad9-2f9d-4e45-945d-a78dc9a3e53b'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 1::numeric),
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 1::numeric),
  ('8eb2bf70-d5a6-4d4c-8464-78aa10250a49'::uuid, 2::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 5::numeric),
  ('387b307d-487f-4957-a23a-40277f1dae93'::uuid, 1::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 1::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 7::numeric),
  ('5b3ff89b-aa37-43e4-b732-3008538cc11e'::uuid, 4::numeric),
  ('3f99c8b5-adbc-4878-a20c-de510afeac59'::uuid, 1::numeric),
  ('bdc5bcdf-dc06-4146-8dd1-2a561f4e33fe'::uuid, 1::numeric),
  ('8bb4bfda-5137-461e-99a2-3879cf645adf'::uuid, 2::numeric),
  ('0a3a33f8-700a-4e1e-aa42-ce7bed244eff'::uuid, 2::numeric),
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 1::numeric),
  ('7f8a9cb4-0125-4b3d-8649-cbb85938fabf'::uuid, 1::numeric),
  ('47ac6d26-ef29-4b0c-88c5-783dbbe8ea00'::uuid, 2::numeric),
  ('71681a61-96a9-4481-8730-c1e31f09af82'::uuid, 5::numeric),
  ('5b7cea6c-04c4-470d-a8f7-4024d0cbc4e6'::uuid, 3::numeric),
  ('48336d65-466e-4803-bc6c-118ba2d3ea65'::uuid, 3::numeric),
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 4::numeric),
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 4::numeric),
  ('e1360a82-9046-48f6-abf5-574bf8dbc145'::uuid, 4::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 2::numeric),
  ('de5f7ff4-bc26-4e40-9827-fd5225425248'::uuid, 1::numeric),
  ('9bcb5001-cdbe-41f4-be9e-5a2b5124efc8'::uuid, 1::numeric),
  ('6dc75097-5642-4952-9274-339dfb66c577'::uuid, 1::numeric),
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 1::numeric),
  ('3676e3db-30e3-49ee-8efd-d3d2f938a3e5'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 4::numeric),
  ('c465ea24-6b3c-44f6-8356-f28a398d32c2'::uuid, 2::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 1::numeric),
  ('0c479758-b730-4b93-b541-bfa4fa1ece88'::uuid, 2::numeric),
  ('e2fc7595-fdd0-4227-bcbc-5d3165cc16f6'::uuid, 1::numeric),
  ('4df2297b-d2ea-4cff-8ed9-0ca2888edf39'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 5::numeric),
  ('3f53a558-0fd6-4eae-91c7-71ce55f9618a'::uuid, 1::numeric),
  ('3ef30178-617c-43e2-bd98-ee66bef1034b'::uuid, 1::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 1::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 9::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),
  ('dea7b11e-9e50-4ba6-b8dc-a8688004cc74'::uuid, 2::numeric),
  ('2d8cf879-8c91-4665-80fe-827841114bdb'::uuid, 1::numeric),
  ('b00cf6f8-9583-40c9-87d7-b2e71f7fa4ea'::uuid, 2::numeric),
  ('86b14247-16d1-4cd0-b2b1-f07343b79f3e'::uuid, 4::numeric),
  ('2c24ce83-ffaa-4f3b-b46a-a842c968d340'::uuid, 2::numeric),
  ('117ebf1c-ba29-41dd-805b-96e5237ffd4b'::uuid, 3::numeric),
  ('45ed7877-2e8b-4b00-b599-bd8a85ba4955'::uuid, 2::numeric),
  ('cc2f679a-ea5b-4763-be0d-af0588f378d8'::uuid, 4::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 2::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 2::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 6::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 4::numeric),
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),
  ('573b3733-797b-409e-80a1-8df2522032bc'::uuid, 2::numeric),
  ('99b58d91-a6c8-434c-ba76-5e9efe7c7873'::uuid, 1::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 50::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 10::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 30::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 8::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 13::numeric),
  ('e166acf7-d008-440f-8f9d-8392d3a0dd7c'::uuid, 4::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 1::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 1::numeric),
  ('5b074b27-0747-467a-843e-cd440148ff1a'::uuid, 1::numeric),
  ('13402805-34bd-4c0d-a083-b35ee1bc4e4f'::uuid, 1::numeric)
) AS v(part_id, quantity);

-- ----------------------------------------------------------------------
-- Post-apply assertions
-- ----------------------------------------------------------------------

DO $$
DECLARE
  v_count int;
  v_van_items int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM van_stocks WHERE technician_id IN (
    'b08b2889-0209-4295-96b9-7e4e65d93036'::uuid,
    '646a70cb-a177-4d30-becf-46804fb1f079'::uuid,
    'b944a683-46fc-4dfd-a9fd-05067545e795'::uuid,
    'e5685686-5ce8-47dd-954c-eb03ebb644bb'::uuid,
    'd6c28c72-7a50-4ca4-86c2-4125fbcb5788'::uuid,
    '5d86aad7-c8b7-45c9-8096-5f985b437e11'::uuid
  );
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'Expected 6 van_stocks for the 6 imported techs, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_van_items
  FROM van_stock_items vsi
  JOIN van_stocks vs ON vs.van_stock_id = vsi.van_stock_id
  WHERE vs.technician_id = 'b08b2889-0209-4295-96b9-7e4e65d93036'::uuid;
  IF v_van_items <> 102 THEN
    RAISE EXCEPTION 'BASRI van should have 102 items, got %', v_van_items;
  END IF;

  SELECT COUNT(*) INTO v_van_items
  FROM van_stock_items vsi
  JOIN van_stocks vs ON vs.van_stock_id = vsi.van_stock_id
  WHERE vs.technician_id = '646a70cb-a177-4d30-becf-46804fb1f079'::uuid;
  IF v_van_items <> 58 THEN
    RAISE EXCEPTION 'BON van should have 58 items, got %', v_van_items;
  END IF;

  SELECT COUNT(*) INTO v_van_items
  FROM van_stock_items vsi
  JOIN van_stocks vs ON vs.van_stock_id = vsi.van_stock_id
  WHERE vs.technician_id = 'b944a683-46fc-4dfd-a9fd-05067545e795'::uuid;
  IF v_van_items <> 80 THEN
    RAISE EXCEPTION 'FIRDAUS van should have 80 items, got %', v_van_items;
  END IF;

  SELECT COUNT(*) INTO v_van_items
  FROM van_stock_items vsi
  JOIN van_stocks vs ON vs.van_stock_id = vsi.van_stock_id
  WHERE vs.technician_id = 'e5685686-5ce8-47dd-954c-eb03ebb644bb'::uuid;
  IF v_van_items <> 72 THEN
    RAISE EXCEPTION 'HAFIZ van should have 72 items, got %', v_van_items;
  END IF;

  SELECT COUNT(*) INTO v_van_items
  FROM van_stock_items vsi
  JOIN van_stocks vs ON vs.van_stock_id = vsi.van_stock_id
  WHERE vs.technician_id = 'd6c28c72-7a50-4ca4-86c2-4125fbcb5788'::uuid;
  IF v_van_items <> 89 THEN
    RAISE EXCEPTION 'HAN van should have 89 items, got %', v_van_items;
  END IF;

  SELECT COUNT(*) INTO v_van_items
  FROM van_stock_items vsi
  JOIN van_stocks vs ON vs.van_stock_id = vsi.van_stock_id
  WHERE vs.technician_id = '5d86aad7-c8b7-45c9-8096-5f985b437e11'::uuid;
  IF v_van_items <> 74 THEN
    RAISE EXCEPTION 'HASRUL van should have 74 items, got %', v_van_items;
  END IF;

END $$;

COMMIT;
