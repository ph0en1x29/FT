-- 20260504_van_stock_3_vans_addition.sql
--
-- Additional Van Stock data for 3 more technicians, from Shin's xlsx
-- checklists (Acwer Service Van Checklist) handed over 2026-05-04:
--   - HISHAM (tech13) plate BRK 3280  — checked 2026-04-23
--   - ONG    (tech21) plate VFA 6286  — checked 2026-04-28
--   - SHEN   (tech8)  plate FA 8326   — checked 2026-04-29
--
-- This is a follow-on to 20260424_van_stock_6_vans_initial.sql which loaded
-- the first batch of 6 vans (BASRI/BON/FIRDAUS/HAFIZ/HAN/HASRUL).
--
-- Source files: /home/jay/Downloads/Ft/<TECHNAME> <PLATE>.xlsx
--
-- Code resolution: 138/139 unique codes matched parts.part_code directly;
-- 1 fuzzy resolved (same variant the prior migration handled):
--   "23303-64010 B" + desc "FUEL FILTER 1182 @ NISSIN" -> 23303-64010B
--   (occurs in HISHAM and SHEN)
--
-- Schema notes:
--   - van_stocks has UNIQUE(technician_id). Pre-flight verified all 3 techs
--     currently have 0 van_stocks; inserts will not conflict.
--   - van_stock_items has UNIQUE(van_stock_id, part_id). HISHAM's xlsx had
--     2 rows with the same code (a single duplicate "BUSH 20X25") — merged
--     into one row by summing quantity (6 + 7 = 13). Original row count in
--     HISHAM xlsx was 93; after dedup 92 rows (matches xlsx unique-code count).
--   - van_stock_items: populating quantity only. container_quantity/bulk_quantity
--     default to 0 — matches the non-liquid historical pattern from the
--     prior 6-van migration. Liquid line items get quantity only; admins
--     can adjust the container breakdown via the UI if needed.
--   - max_items set to the actual unique-code count per van.
--   - created_by set to admin1@example.com (Admin One) as the import actor.
--
-- Safety: single BEGIN/COMMIT with post-insert assertion (3 new van_stocks +
-- expected item counts per van).

BEGIN;

-- HISHAM: HISHAM BRK 3280.xlsx  plate=BRK 3280  items=92  (tech=tech13@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '1bf5cb64-7cc7-4b97-8063-97a148c460fa', 'BRK 3280', 92, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (HISHAM BRK 3280.xlsx, checked 26.04.23).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('ce8baa51-5a76-4c4b-8faa-c95f984e9757'::uuid, 4::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('d9bf0efe-8cfb-44a2-ac9b-c1b4766baa6e'::uuid, 1::numeric),
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 2::numeric),
  ('13c1f811-96bc-4a61-b927-08cd28ba9008'::uuid, 2::numeric),
  ('387b307d-487f-4957-a23a-40277f1dae93'::uuid, 1::numeric),
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 1::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 5::numeric),
  ('7c96047f-6e25-4a2f-8e9a-fd86843ec568'::uuid, 5::numeric),
  ('f9bccbee-575c-49a9-94c4-98d4286d279b'::uuid, 13::numeric),
  ('6f4314ce-18fd-4581-9ea0-e73245900f51'::uuid, 2::numeric),
  ('a04c56e2-c23b-4990-942e-03399efa36b4'::uuid, 1::numeric),
  ('3fc49835-877b-4263-83ab-a6e983c5fdd8'::uuid, 1::numeric),
  ('53191897-d0c0-443f-b759-bf27be13df75'::uuid, 1::numeric),
  ('3f99c8b5-adbc-4878-a20c-de510afeac59'::uuid, 1::numeric),
  ('48b02114-a333-4cfb-a60e-9a8099323e42'::uuid, 1::numeric),
  ('7c1f5ecf-502b-4d78-a5c9-8ea2ff5261ca'::uuid, 1::numeric),
  ('28d1d13f-c874-4cb3-8883-497549817d16'::uuid, 4::numeric),
  ('2e5d4608-e858-482b-a2cb-2f98e980d7cf'::uuid, 4::numeric),
  ('efa39bb1-a330-44a1-ada6-56e7a61c343a'::uuid, 4::numeric),
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 4::numeric),
  ('1301f9bd-95ce-40ae-8cab-ee4a54d85a2c'::uuid, 2::numeric),
  ('92f6daf1-8c72-46fa-9e0f-b1efaccb8741'::uuid, 3::numeric),
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),
  ('5c496209-808a-4679-85a0-ae2764fb357c'::uuid, 2::numeric),
  ('96f60ff4-f5b4-404b-95df-19376a6045c9'::uuid, 2::numeric),
  ('919d1b44-9a10-4ba5-9bd7-e01294f98363'::uuid, 2::numeric),
  ('773bd637-fa00-4a92-834f-e6f677d1dd2c'::uuid, 4::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 5::numeric),
  ('de5f7ff4-bc26-4e40-9827-fd5225425248'::uuid, 1::numeric),
  ('0c479758-b730-4b93-b541-bfa4fa1ece88'::uuid, 2::numeric),
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 3::numeric),
  ('3676e3db-30e3-49ee-8efd-d3d2f938a3e5'::uuid, 3::numeric),
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 1::numeric),
  ('3396f0f2-dfaa-450d-bd28-8f1c8e518472'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 6::numeric),
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 2::numeric),
  ('e2fc7595-fdd0-4227-bcbc-5d3165cc16f6'::uuid, 2::numeric),
  ('e0934fdb-8bdd-4e17-9dff-60fd14e332d7'::uuid, 1::numeric),
  ('c465ea24-6b3c-44f6-8356-f28a398d32c2'::uuid, 2::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 2::numeric),
  ('5dc6d365-d804-4275-86f0-e072ee7578d4'::uuid, 1::numeric),
  ('3004f59a-4eec-436e-8c1f-b03b1f4008d5'::uuid, 1::numeric),
  ('3b3b7906-e749-4428-9144-4320e671bb32'::uuid, 1::numeric),
  ('cca10a68-05bf-4f25-9755-6f74d84c8bd0'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 12::numeric),
  ('97e5a705-5957-4a1f-9bd0-abc409d67137'::uuid, 1::numeric),
  ('984c9613-5b2a-4a6e-98b1-e74abc9a17bc'::uuid, 1::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 6::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 10::numeric),
  ('0750c8ff-e8ed-4b19-b36b-c95566bfed80'::uuid, 1::numeric),
  ('675b0e9e-ee00-4c4a-b4eb-c8548422c0a5'::uuid, 3::numeric),
  ('630b5ec1-da65-4b2c-a174-f7fb4e7d2386'::uuid, 1::numeric),
  ('96b3dd23-8c4d-4fac-9474-7a59d816b1b3'::uuid, 1::numeric),
  ('dea7b11e-9e50-4ba6-b8dc-a8688004cc74'::uuid, 2::numeric),
  ('604b5542-169b-4033-a8f7-b0e2dfca2008'::uuid, 1::numeric),
  ('26153f47-f686-4412-b2e7-93797136c1d2'::uuid, 2::numeric),
  ('643da154-7f6e-4af1-a2ff-6e819abcef11'::uuid, 2::numeric),
  ('57632184-e0d1-40c1-bb14-4d86baa1884b'::uuid, 2::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 2::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 1::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 11::numeric),
  ('a3d79f70-018c-4692-84b6-ccbad60d658d'::uuid, 1::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 2::numeric),
  ('b8ed3ee3-75ff-41cd-a79c-38131f071795'::uuid, 2::numeric),
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),
  ('2fea7c16-b728-4b19-b44b-0202907bc88c'::uuid, 1::numeric),
  ('6bb16593-dcb3-4786-aaf2-ca9cd8902640'::uuid, 2::numeric),
  ('34c0a8f6-26d1-4446-995d-47edab06268b'::uuid, 1::numeric),
  ('18c5a379-3b35-4ecf-86b9-95433b941e43'::uuid, 2::numeric),
  ('c3f4af5b-cc53-4789-b118-87e6c270d751'::uuid, 1::numeric),
  ('1d3a8d2c-2eb2-49ac-86e8-384babc606d7'::uuid, 1::numeric),
  ('d2b81962-56f3-4024-a5a6-60c2f9a65c1e'::uuid, 1::numeric),
  ('4da7baa7-7c43-4625-ae2a-0ff4f09995e0'::uuid, 1::numeric),
  ('9c5861b7-d116-4d29-9536-80d2d16d60ac'::uuid, 1::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 32::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 4::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 40::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 3::numeric),
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 5::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 2::numeric),
  ('e166acf7-d008-440f-8f9d-8392d3a0dd7c'::uuid, 4::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 3::numeric),
  ('cb238a4d-799a-4fa3-9e71-036093ab2494'::uuid, 2::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 1::numeric),
  ('5b074b27-0747-467a-843e-cd440148ff1a'::uuid, 1::numeric),
  ('13402805-34bd-4c0d-a083-b35ee1bc4e4f'::uuid, 1::numeric)
) AS v(part_id, quantity);

-- ONG: ONG VFA 6286.xlsx  plate=VFA 6286  items=57  (tech=tech21@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '972ad13e-71aa-4f47-b1a4-d11daeadbee5', 'VFA 6286', 57, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (ONG VFA 6286.xlsx, checked 26.04.28).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 1::numeric),
  ('d43ab6e2-3b69-4db6-b510-7af7e165cb19'::uuid, 1::numeric),
  ('7c96047f-6e25-4a2f-8e9a-fd86843ec568'::uuid, 5::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 1::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 6::numeric),
  ('162ac8ec-a1db-4aca-a629-e17546c4c2ee'::uuid, 2::numeric),
  ('5e611713-13bd-48ed-999c-3958492e0301'::uuid, 2::numeric),
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 1::numeric),
  ('9bfec9cb-368f-47bf-8ee5-1cad059ddfb4'::uuid, 4::numeric),
  ('ed6ec54e-d40e-4a3c-8501-17c5c117f05f'::uuid, 2::numeric),
  ('e1360a82-9046-48f6-abf5-574bf8dbc145'::uuid, 6::numeric),
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 2::numeric),
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 4::numeric),
  ('70126e4e-2082-403e-acc1-4f614c9118d7'::uuid, 2::numeric),
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 4::numeric),
  ('de5f7ff4-bc26-4e40-9827-fd5225425248'::uuid, 1::numeric),
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 1::numeric),
  ('c465ea24-6b3c-44f6-8356-f28a398d32c2'::uuid, 1::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 2::numeric),
  ('e2fc7595-fdd0-4227-bcbc-5d3165cc16f6'::uuid, 2::numeric),
  ('a447be69-bc5c-4640-bfa4-c1ed4badbbcc'::uuid, 1::numeric),
  ('5dc6d365-d804-4275-86f0-e072ee7578d4'::uuid, 2::numeric),
  ('4df2297b-d2ea-4cff-8ed9-0ca2888edf39'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 7::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 6::numeric),
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 2::numeric),
  ('8d510242-ee96-4c86-a179-0c5b0ab747b2'::uuid, 1::numeric),
  ('4542c343-24a3-4566-bca1-1cb0efb6c4b8'::uuid, 1::numeric),
  ('99ed350a-72ba-4043-8eec-59efc2d7f4a0'::uuid, 1::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 1::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 2::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 6::numeric),
  ('a3d79f70-018c-4692-84b6-ccbad60d658d'::uuid, 1::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 3::numeric),
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),
  ('2fea7c16-b728-4b19-b44b-0202907bc88c'::uuid, 1::numeric),
  ('6bb16593-dcb3-4786-aaf2-ca9cd8902640'::uuid, 1::numeric),
  ('37f6221d-4510-41df-8bf9-d0672ca8e4a6'::uuid, 1::numeric),
  ('1d3a8d2c-2eb2-49ac-86e8-384babc606d7'::uuid, 1::numeric),
  ('b6b4e2e9-e08f-4895-9c1e-b70d8c85a59f'::uuid, 4::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 10::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 20::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 7::numeric),
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 6::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 7::numeric),
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 1::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('790a87fe-ebf0-4a29-adf1-c4f47d53aab1'::uuid, 2::numeric),
  ('6b212f82-df7b-47c9-b702-c9ad527e77d1'::uuid, 3::numeric)
) AS v(part_id, quantity);

-- SHEN: SHEN FA8326.xlsx  plate=FA 8326  items=55  (tech=tech8@example.com)
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '196a25c2-cf5f-4025-975e-c880615b42b9', 'FA 8326', 55, 'active', true,
    (SELECT user_id FROM users WHERE email='admin1@example.com' LIMIT 1),
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (SHEN FA8326.xlsx, checked 26.04.29).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 1::numeric),
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),
  ('81751600-d08a-4743-a654-5a5b724dabeb'::uuid, 1::numeric),
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 2::numeric),
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 2::numeric),
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 14::numeric),
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 10::numeric),
  ('96430ee5-948e-4d4d-938f-0321071e7127'::uuid, 1::numeric),
  ('b116fa1d-7bce-4d28-9762-b41fd0ac86bb'::uuid, 4::numeric),
  ('5e611713-13bd-48ed-999c-3958492e0301'::uuid, 6::numeric),
  ('d8d6bd72-7130-4146-b8e2-39b36bd68681'::uuid, 3::numeric),
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 2::numeric),
  ('61a92537-1f64-4568-ae4d-2f62d6f3d8ee'::uuid, 1::numeric),
  ('8bb4bfda-5137-461e-99a2-3879cf645adf'::uuid, 1::numeric),
  ('4f712776-04bb-4fb9-9b83-34dadec6ce97'::uuid, 2::numeric),
  ('71681a61-96a9-4481-8730-c1e31f09af82'::uuid, 4::numeric),
  ('a63b034e-5227-45b5-9447-2599a86f7a1d'::uuid, 2::numeric),
  ('9bfec9cb-368f-47bf-8ee5-1cad059ddfb4'::uuid, 1::numeric),
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 11::numeric),
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 5::numeric),
  ('2a51597f-76fc-4924-af73-0e3d74c0d156'::uuid, 1::numeric),
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 3::numeric),
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 3::numeric),
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 1::numeric),
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 5::numeric),
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 3::numeric),
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 7::numeric),
  ('8068d52c-7a28-4901-a91c-c31f50f1e432'::uuid, 1::numeric),
  ('22cce18d-d386-4eaa-b2c0-20f33c801c1f'::uuid, 1::numeric),
  ('0c58aac2-0ad3-4224-a2dd-27d0ca2e3201'::uuid, 1::numeric),
  ('2d8cf879-8c91-4665-80fe-827841114bdb'::uuid, 10::numeric),
  ('c9e8ed69-0e71-43a5-8dd8-ff7346ed3a53'::uuid, 1::numeric),
  ('e255c1f2-0541-4549-af35-3ea44a707da7'::uuid, 4::numeric),
  ('76b784d5-9d56-43a7-ad6e-8eff52074857'::uuid, 6::numeric),
  ('9017a3ae-2068-454d-8d07-8ebbf7d43eb9'::uuid, 1::numeric),
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 1::numeric),
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 1::numeric),
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 10::numeric),
  ('a3d79f70-018c-4692-84b6-ccbad60d658d'::uuid, 1::numeric),
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 7::numeric),
  ('c3f4af5b-cc53-4789-b118-87e6c270d751'::uuid, 1::numeric),
  ('34c0a8f6-26d1-4446-995d-47edab06268b'::uuid, 1::numeric),
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 20::numeric),
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 6::numeric),
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 20::numeric),
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 9::numeric),
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 7::numeric),
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),
  ('866f727f-7b83-40cd-ae89-b9869720ce83'::uuid, 4::numeric),
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 1::numeric),
  ('3477a84e-6166-4f9e-a003-612c84b23608'::uuid, 8::numeric),
  ('67ba4eae-2803-4e28-b20a-67337a2328cd'::uuid, 2::numeric),
  ('db71512b-7d9d-40f9-b597-7e6a816daf3c'::uuid, 8::numeric)
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
   WHERE van_plate IN ('BRK 3280', 'VFA 6286', 'FA 8326');
  IF van_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 new van_stocks rows, got %', van_count;
  END IF;

  SELECT COUNT(*) INTO item_count
    FROM van_stock_items i
    JOIN van_stocks v USING (van_stock_id)
    WHERE v.van_plate IN ('BRK 3280', 'VFA 6286', 'FA 8326');
  IF item_count <> 204 THEN
    RAISE EXCEPTION 'Expected 204 new van_stock_items, got %', item_count;
  END IF;

  RAISE NOTICE 'Van Stock 3-vans-addition migration applied: % vans, % items', van_count, item_count;
END $$;
