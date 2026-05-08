-- 20260508_van_stock_4_more_vans_shyan_lun_yuan_syahril.sql
--
-- Additional Van Stock data for 4 more technicians, from Shin's xlsx
-- checklists handed over 2026-05-08 (latest roster pic + xlsx batch):
--   - SHYAN   (tech7)  plate VLG 6232 - checked 29.04.26
--   - LUN     (tech12) plate BRL 3628 - checked 27.04.26
--   - YUAN    (tech11) plate BRK 9093 - checked 05.05.26
--   - SYAHRIL (tech16) plate VCG 9318 - checked 04.05.26
--
-- This is a follow-on to:
--   - 20260424_van_stock_6_vans_initial.sql        (BASRI/BON/FIRDAUS/HAFIZ/HAN/HASRUL)
--   - 20260504_van_stock_3_vans_addition.sql       (HISHAM/ONG/SHEN)
--   - 20260505_van_stock_2_vans_addition.sql       (P.SIANG/SYUKRI)
--   - 20260506_van_stock_2_more_vans_kim_fadhil.sql (KIM/FADHIL)
-- After this migration: 17 technician vans seeded (tech9 EU SENG CHEONG
-- has no van per the 2026-05-07 roster).
--
-- Source files: /home/jay/Downloads/Ft/{SHYAN VLG6232,LUN BRL 3628,YUAN BRK9093,SYAHRIL VCG9318}.xlsx
--
-- Code resolution: 185 unique normalized codes across all 4 vans.
-- All 185 matched parts.part_code via whitespace-insensitive lookup
-- (one xlsx row had '23303-64010 B' which matches existing
--  '23303-64010B' / FUEL FILTER 1182B @ NISSIN). No parts were created.
--
-- Duplicate handling: SYAHRIL's xlsx had 2 in-file duplicates
-- (S-00554 GAS CHAMBER IMPCO; 62002042 REMA 80-MALE 25MM, each listed
-- twice with qty=1). Consolidated to qty=2 to satisfy
-- UNIQUE(van_stock_id, part_id). Net unique parts in VCG 9318 = 102
-- from 104 spreadsheet rows.
--
-- Liquid routing: trigger 'trg_route_liquid_to_bulk_quantity' (added in
-- 20260504_van_stock_liquid_routing_guard.sql) auto-routes liquid
-- 'quantity' values into 'bulk_quantity' at INSERT time. The migration
-- writes plain quantity; the trigger handles the rest.
--
-- Schema notes:
--   - van_stocks has UNIQUE(technician_id). Pre-flight confirmed all
--     4 techs (SHYAN/LUN/YUAN/SYAHRIL) have 0 van_stocks rows.
--   - van_stock_items has UNIQUE(van_stock_id, part_id). Per-van dupes
--     are pre-summed (above).
--   - max_items set to actual unique-part count per van.
--   - created_by set to admin1@example.com (Admin One) as the importer.
--
-- Safety: single BEGIN/COMMIT with post-insert assertions for each van.

BEGIN;

-- BEH CHOON SHYAN (VLG 6232): SHYAN VLG6232.xlsx - checked 29.04.26 - 89 unique parts
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '2545b6b7-32cd-4ec5-8a68-3404e1494050'::uuid, 'VLG 6232', 89, 'active', true,
    '77a0f88d-2cc0-4874-8c29-a6c63656d191'::uuid,
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (SHYAN VLG6232.xlsx, checked 29.04.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),  -- ALTERNATOR [1DZ/14Z]
  ('b9c58cb3-5333-49bc-8319-3bba553b47bc'::uuid, 1::numeric),  -- ALTERNATOR SOCKET HX-7320
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),  -- BATTERY 105D31L / 125D31L [COZZIE]
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),  -- BATTERY 55B24LS [FRED]
  ('ebc5b87c-d42c-4be0-83f5-6dfa40baa60a'::uuid, 1::numeric),  -- BATTERY STAND SPRING 6FBRE [2MMX22MMX43.7MMX135MM]
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 2::numeric),  -- BATTERY CONNECTOR GREY [SB350-70MM]
  ('153359ab-ea56-411e-8e86-ba09b153062b'::uuid, 2::numeric),  -- BULB 67V 24V [SMALL]
  ('7c96047f-6e25-4a2f-8e9a-fd86843ec568'::uuid, 4::numeric),  -- BULB 60V 25/10W BAY15D
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 8::numeric),  -- BRAKE BULB 1016 [48V] TW
  ('81751600-d08a-4743-a654-5a5b724dabeb'::uuid, 1::numeric),  -- BATTERY CONNECTOR [MALE] - DIESEL
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 14::numeric),  -- BRAKE BULB 1016 [12V] TW
  ('3fc49835-877b-4263-83ab-a6e983c5fdd8'::uuid, 1::numeric),  -- BONET LOCK SPRING
  ('cf2f5680-5cc2-49d5-a29d-448cb3575953'::uuid, 1::numeric),  -- BATTERY STAND SPRING 6FBR/FBRE[1.8X22X80.4X150]
  ('96430ee5-948e-4d4d-938f-0321071e7127'::uuid, 1::numeric),  -- BUZZER 48V
  ('e1c53926-e182-4860-8a3f-6c478f8ce7a3'::uuid, 1::numeric),  -- COMPRESSION SPRING [BT BRAKE PRESSURE SPRING]
  ('8bb4bfda-5137-461e-99a2-3879cf645adf'::uuid, 1::numeric),  -- CARBON BRUSH P/S MOTOR 8X8X21 [BT]
  ('a1dbbfa1-5a15-4ba8-816a-99bf4f74be7f'::uuid, 4::numeric),  -- CARBON BRUSH 6MMX7.5MMX17MM [BT NEW MODEL]
  ('5e611713-13bd-48ed-999c-3958492e0301'::uuid, 2::numeric),  -- CARBON BRUSH 15X6X20 [ 7FBR ]
  ('773bd637-fa00-4a92-834f-e6f677d1dd2c'::uuid, 4::numeric),  -- CARBON BRUSH 25X10X23 [DRIVE MOTOR] BT PT
  ('d8d6bd72-7130-4146-b8e2-39b36bd68681'::uuid, 2::numeric),  -- CARBON BRUSH POWER STEERING MOTOR 30X8X24 [7FB]
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 5::numeric),  -- CARBURATOR GASKET
  ('4e499c32-0399-4728-82db-09bbab0134ae'::uuid, 1::numeric),  -- CLUTCH SPRING - 8S
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),  -- CONTROL VALVE LIMIT SWITCH - HORIZONTAL
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 1::numeric),  -- CONTROL VALVE LIMIT SWITCH - STRAIGHT
  ('71681a61-96a9-4481-8730-c1e31f09af82'::uuid, 4::numeric),  -- COPPER FIAT WASHER [M20X25]
  ('48336d65-466e-4803-bc6c-118ba2d3ea65'::uuid, 4::numeric),  -- COLLER 20X25X74
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 10::numeric),  -- DEEP GROOVE BALL BEARING 6204 2RS @TSSB
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 2::numeric),  -- DEEP GROOVE BALL BEARING 6304 2RS @TSSB
  ('e1360a82-9046-48f6-abf5-574bf8dbc145'::uuid, 1::numeric),  -- DEEP GROOVE BALL BEARING 6205 2RS
  ('7f5378b2-3f21-4f8f-8050-3c979e5f078e'::uuid, 2::numeric),  -- DEEP GROOVE BALL BEARING 6210DDU C3 @NSK
  ('9bfec9cb-368f-47bf-8ee5-1cad059ddfb4'::uuid, 8::numeric),  -- DEEP GROOVE BALL BEARING 6303-2RS
  ('0eca73ce-26ab-45df-bba8-c032f036f2b7'::uuid, 1::numeric),  -- DEEP GROOVE BALL BEARING 6302DDU C3 @NSK
  ('a63b034e-5227-45b5-9447-2599a86f7a1d'::uuid, 2::numeric),  -- DEEP GROOVE BALL BEARING 6306DDU C3  @NSK
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 15::numeric),  -- DRAIN PLUG GASKET 25X34
  ('de5f7ff4-bc26-4e40-9827-fd5225425248'::uuid, 1::numeric),  -- DISTRIBUTOR CAP[1301077]
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 1::numeric),  -- FAN BELT 3460
  ('3676e3db-30e3-49ee-8efd-d3d2f938a3e5'::uuid, 1::numeric),  -- FAN BELT 5470 IDZ
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 1::numeric),  -- FAN BELT 5480 IDZ II
  ('cca10a68-05bf-4f25-9755-6f74d84c8bd0'::uuid, 1::numeric),  -- FAN DC24V 120X120X38MM
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 4::numeric),  -- FUEL FILTER 1182
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 2::numeric),  -- FUEL FILTER 1182B @ NISSIN
  ('c465ea24-6b3c-44f6-8356-f28a398d32c2'::uuid, 1::numeric),  -- FUSE 125A
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 4::numeric),  -- FUSE 100A
  ('5dc6d365-d804-4275-86f0-e072ee7578d4'::uuid, 1::numeric),  -- FUSE 160A
  ('3b3b7906-e749-4428-9144-4320e671bb32'::uuid, 1::numeric),  -- FAN DC48V 120X120X38MM
  ('4df2297b-d2ea-4cff-8ed9-0ca2888edf39'::uuid, 1::numeric),  -- GAS TANK HEAD @ GAS ADAPTOR
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 2::numeric),  -- GRANTT ATF DEX-III [18L]
  ('3ef30178-617c-43e2-bd98-ee66bef1034b'::uuid, 1::numeric),  -- GRANTT COOLANT 1 LITER
  ('0750c8ff-e8ed-4b19-b36b-c95566bfed80'::uuid, 1::numeric),  -- HAND BRAKE CABLE [8FD/FG]
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 4::numeric),  -- HEAD LAMP BULB (48V) [6/7 FB/FBRE/FBR/ BT]
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 1::numeric),  -- HEAD LAMP H3 BULB [12V]
  ('8068d52c-7a28-4901-a91c-c31f50f1e432'::uuid, 1::numeric),  -- HORN SWITCH
  ('2d8cf879-8c91-4665-80fe-827841114bdb'::uuid, 2::numeric),  -- HPT LOAD WHEEL 82X93MM [NYLON]
  ('b00cf6f8-9583-40c9-87d7-b2e71f7fa4ea'::uuid, 2::numeric),  -- HPT LOAD WHEEL 82X93MM [PU]
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 2::numeric),  -- LION DISC HORN 12V
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),  -- HORN 48V [7FB]
  ('22cce18d-d386-4eaa-b2c0-20f33c801c1f'::uuid, 1::numeric),  -- HORN 24V HELLA
  ('dea7b11e-9e50-4ba6-b8dc-a8688004cc74'::uuid, 1::numeric),  -- HOSE CLIP 27-51MM NIETZ
  ('8d510242-ee96-4c86-a179-0c5b0ab747b2'::uuid, 1::numeric),  -- JAPAN BATTERY CONNECTOR PLUG (FEMALE) 4POLE 30A-250V
  ('9017a3ae-2068-454d-8d07-8ebbf7d43eb9'::uuid, 1::numeric),  -- LONG LEVER WITH ROLLER
  ('e255c1f2-0541-4549-af35-3ea44a707da7'::uuid, 4::numeric),  -- LOAD WHEEL
  ('c9e8ed69-0e71-43a5-8dd8-ff7346ed3a53'::uuid, 1::numeric),  -- LED BEACON LIGHT [ORANGE COLOUR]
  ('adcfb074-650f-4e23-8198-4485d944b3b0'::uuid, 2::numeric),  -- LOAD WHEEL
  ('f13d079d-c6d9-46f0-8d8f-028a371c9352'::uuid, 1::numeric),  -- LPG  ELBOW ADAPTOR
  ('99ed350a-72ba-4043-8eec-59efc2d7f4a0'::uuid, 1::numeric),  -- MK-PLUG TOP-13A-654
  ('86b14247-16d1-4cd0-b2b1-f07343b79f3e'::uuid, 4::numeric),  -- MACHINE COLLER[P/T] 20X76X13
  ('94d9970f-09eb-430e-a220-e9edbb471fe7'::uuid, 1::numeric),  -- NIPPLE M6X1.0
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 2::numeric),  -- OIL FILTER 1631 [O-PC15]
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 2::numeric),  -- OIL FILTER 1636
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 6::numeric),  -- OIL FILTER 1637
  ('41d72247-d2cf-4c4c-a930-9ef4ad90360e'::uuid, 1::numeric),  -- OIL FILTER 1637
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 4::numeric),  -- OIL PAN NUT GASKET @ FITING 12X23.5
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),  -- PLUG WIRE
  ('b8ed3ee3-75ff-41cd-a79c-38131f071795'::uuid, 1::numeric),  -- PARKING BRAKE SPRING 6FBRE[1.6MM T X 13MM OD X 37MM BL X 75MM TL
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 36::numeric),  -- SHELL RIMULA R4PLUS 15W40 [209L] @ DIESEL ENGINE OIL
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 2::numeric),  -- SHELL SPIRAX S2 G 90 [209L] @ GEAR OIL 90
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 20::numeric),  -- SHELL TELLUS S2 MX 68 [209L] @ HYDRAULIC OIL
  ('2dc017ae-13d0-448b-94db-4dddd1d252fc'::uuid, 1::numeric),  -- SPRING [2MMX12MMX17MM] RRE
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 13::numeric),  -- SIGNAL BULB 1141 [48V] VITALITE [1 PIN]
  ('4636139c-68fe-487b-ba98-578092dab488'::uuid, 1::numeric),  -- SPRING 8S
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 4::numeric),  -- SIGNAL REVERSE BULB 1141 [12V] STL
  ('68902dd8-72c2-4be6-b54e-315f64cb11c0'::uuid, 4::numeric),  -- SCREW LT2200/PPT1600-A
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 1::numeric),  -- SPARK PLUG W16EX-U
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 5::numeric),  -- SPRAY N10
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),  -- STARTER SUB ASSY 5/6/7/8FG 10-30
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),  -- STARTER, IDZ, 14Z 62-8FD15-30
  ('790a87fe-ebf0-4a29-adf1-c4f47d53aab1'::uuid, 3::numeric),  -- SIDE SHIFT SPRING
  ('9bf100fe-54be-4b7b-8559-d8bc7fc2ff2e'::uuid, 1::numeric),  -- SIDE SHIFT CABLE BRACKET
  ('a85ead3e-9af6-4470-97bd-b282ec84e37d'::uuid, 1::numeric)  -- TL 0801 PNEUMATICS ELBOW ADAPTOR
) AS v(part_id, quantity);

-- LEE KAI LUN (BRL 3628): LUN BRL 3628.xlsx - checked 27.04.26 - 106 unique parts
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    'e652c7a0-fd49-430d-8790-d85ac05f9453'::uuid, 'BRL 3628', 106, 'active', true,
    '77a0f88d-2cc0-4874-8c29-a6c63656d191'::uuid,
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (LUN BRL 3628.xlsx, checked 27.04.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 3::numeric),  -- AIR FILTER [1.5-3.5 TON]
  ('77e48199-b03f-477f-8a43-3dec6fd549f5'::uuid, 1::numeric),  -- AC PLUG-FEMALE-WALL TYPE [IP44 32A-5PIN-3PHASE]
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),  -- ALTERNATOR [1DZ/14Z]
  ('1121a256-4e2c-428b-9300-b316165fae38'::uuid, 1::numeric),  -- AC PLUG-FEMALE [IP44 32A 4PIN-3PHASE WALL TYPE]
  ('f0f07d79-fea3-4f34-be72-6b3adbe80771'::uuid, 1::numeric),  -- AC PLUG-MALE [IP44 32A 5PIN-3PHASE]
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),  -- BATTERY 105D31L / 125D31L [COZZIE]
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),  -- BATTERY 55B24LS [FRED]
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 3::numeric),  -- BATTERY CONNECTOR GREY [SB175-50MM]
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 1::numeric),  -- BATTERY CONNECTOR GREY [SB350-70MM]
  ('13c1f811-96bc-4a61-b927-08cd28ba9008'::uuid, 4::numeric),  -- BRAKE PAD (5FBRE-6FBRE)TVH156013
  ('7c96047f-6e25-4a2f-8e9a-fd86843ec568'::uuid, 5::numeric),  -- BULB 60V 25/10W BAY15D
  ('6f4314ce-18fd-4581-9ea0-e73245900f51'::uuid, 2::numeric),  -- BUSH 25X28[35]X25 [LPE200]
  ('d9e177d8-9226-4d49-97da-7f8dfcf84d64'::uuid, 1::numeric),  -- BRAKE BRACKET SPRING[1.8X15X22X62]
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 1::numeric),  -- BATTERY TERMINAL(+) HX-S018A
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 7::numeric),  -- BRAKE BULB 1016 [12V] TW
  ('480fbc6c-1df7-4e95-a703-b19509efc0ab'::uuid, 5::numeric),  -- BT POWER TRUCK SCREW
  ('96430ee5-948e-4d4d-938f-0321071e7127'::uuid, 1::numeric),  -- BUZZER 48V
  ('53191897-d0c0-443f-b759-bf27be13df75'::uuid, 1::numeric),  -- REVERSE HORN BUZZER 12V - 24V
  ('9630b19a-f44f-41f0-bed0-18cc90db0803'::uuid, 6::numeric),  -- BATTERY TERMINAL
  ('8bb4bfda-5137-461e-99a2-3879cf645adf'::uuid, 4::numeric),  -- CARBON BRUSH P/S MOTOR 8X8X21 [BT]
  ('a1dbbfa1-5a15-4ba8-816a-99bf4f74be7f'::uuid, 4::numeric),  -- CARBON BRUSH 6MMX7.5MMX17MM [BT NEW MODEL]
  ('d8d6bd72-7130-4146-b8e2-39b36bd68681'::uuid, 2::numeric),  -- CARBON BRUSH POWER STEERING MOTOR 30X8X24 [7FB]
  ('162ac8ec-a1db-4aca-a629-e17546c4c2ee'::uuid, 10::numeric),  -- CAGE COVER NUT
  ('5e611713-13bd-48ed-999c-3958492e0301'::uuid, 4::numeric),  -- CARBON BRUSH 15X6X20 [ 7FBR ]
  ('cca05ef0-7ab9-4c5b-abc4-9065d9f97afc'::uuid, 2::numeric),  -- CARBURATOR GASKET
  ('48b02114-a333-4cfb-a60e-9a8099323e42'::uuid, 2::numeric),  -- CONTACT
  ('7c1f5ecf-502b-4d78-a5c9-8ea2ff5261ca'::uuid, 1::numeric),  -- CONTACT
  ('92f6daf1-8c72-46fa-9e0f-b1efaccb8741'::uuid, 4::numeric),  -- CABLE LUG 70MM-12
  ('81d71c6d-dfbe-4c6e-ac0b-b33802312272'::uuid, 4::numeric),  -- CABLE LUG 50MM-10
  ('efa39bb1-a330-44a1-ada6-56e7a61c343a'::uuid, 4::numeric),  -- CABLE LUG 35MM-10
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),  -- CONTROL VALVE LIMIT SWITCH - HORIZONTAL
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 1::numeric),  -- CONTROL VALVE LIMIT SWITCH - STRAIGHT
  ('9ccd768f-9e28-44e1-931c-70652ab31678'::uuid, 4::numeric),  -- DRIVE WHEEL NUT
  ('04f3c700-1b70-432f-b840-84c2601156c1'::uuid, 5::numeric),  -- DRIVE WHEEL SCREW
  ('2a51597f-76fc-4924-af73-0e3d74c0d156'::uuid, 6::numeric),  -- DRIVE WHEEL SCREW [6FBRE]
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 4::numeric),  -- DEEP GROOVE BALL BEARING 6204 2RS @TSSB
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 6::numeric),  -- DEEP GROOVE BALL BEARING 6304 2RS @TSSB
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 8::numeric),  -- DRAIN PLUG GASKET 25X34
  ('9bfec9cb-368f-47bf-8ee5-1cad059ddfb4'::uuid, 2::numeric),  -- DEEP GROOVE BALL BEARING 6303-2RS
  ('f45194c2-cb02-482a-bb07-0e7f4e15ad5b'::uuid, 3::numeric),  -- DEEP GROOVE BALL BEARING 6006DDU C3  @NSK
  ('e1360a82-9046-48f6-abf5-574bf8dbc145'::uuid, 6::numeric),  -- DEEP GROOVE BALL BEARING 6205 2RS
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 1::numeric),  -- FAN BELT 3460
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 1::numeric),  -- FAN BELT 5480 IDZ II
  ('3676e3db-30e3-49ee-8efd-d3d2f938a3e5'::uuid, 1::numeric),  -- FAN BELT 5470 IDZ
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 7::numeric),  -- FUEL FILTER 1182
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 2::numeric),  -- FUEL FILTER 1182B @ NISSIN
  ('c465ea24-6b3c-44f6-8356-f28a398d32c2'::uuid, 4::numeric),  -- FUSE 125A
  ('a447be69-bc5c-4640-bfa4-c1ed4badbbcc'::uuid, 3::numeric),  -- FUSE 50A
  ('5dc6d365-d804-4275-86f0-e072ee7578d4'::uuid, 2::numeric),  -- FUSE 160A
  ('8d1bf918-6855-425c-96de-5f6e0e227a30'::uuid, 5::numeric),  -- FUSE HOLDER
  ('cca10a68-05bf-4f25-9755-6f74d84c8bd0'::uuid, 1::numeric),  -- FAN DC24V 120X120X38MM
  ('3b3b7906-e749-4428-9144-4320e671bb32'::uuid, 2::numeric),  -- FAN DC48V 120X120X38MM
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 2::numeric),  -- GRANTT ATF DEX-III [18L]
  ('97e5a705-5957-4a1f-9bd0-abc409d67137'::uuid, 1::numeric),  -- GRANTT BRAKE FLUID DOT3 500ML
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 5::numeric),  -- HEAD LAMP BULB (48V) [6/7 FB/FBRE/FBR/ BT]
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 2::numeric),  -- HEAD LAMP H3 BULB [12V]
  ('025dd3cb-10b0-4664-9a17-22ff1baabdaa'::uuid, 4::numeric),  -- HEAD LAMP H3 BULB [48V] 7FB
  ('675b0e9e-ee00-4c4a-b4eb-c8548422c0a5'::uuid, 2::numeric),  -- HORN CONTACT [7/8FD/G 10-30]
  ('630b5ec1-da65-4b2c-a174-f7fb4e7d2386'::uuid, 2::numeric),  -- HORN CONTACT [6/7FB10-30]
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 2::numeric),  -- LION DISC HORN 12V
  ('095faae2-8d52-4b3c-9c8c-60eca577db61'::uuid, 1::numeric),  -- HORN 48V [BT RT]
  ('2d8cf879-8c91-4665-80fe-827841114bdb'::uuid, 3::numeric),  -- HPT LOAD WHEEL 82X93MM [NYLON]
  ('b00cf6f8-9583-40c9-87d7-b2e71f7fa4ea'::uuid, 1::numeric),  -- HPT LOAD WHEEL 82X93MM [PU]
  ('8d510242-ee96-4c86-a179-0c5b0ab747b2'::uuid, 1::numeric),  -- JAPAN BATTERY CONNECTOR PLUG (FEMALE) 4POLE 30A-250V
  ('e255c1f2-0541-4549-af35-3ea44a707da7'::uuid, 2::numeric),  -- LOAD WHEEL
  ('9017a3ae-2068-454d-8d07-8ebbf7d43eb9'::uuid, 1::numeric),  -- LONG LEVER WITH ROLLER
  ('9f1f27c0-5c65-42e7-8b0f-ae6d60e7573d'::uuid, 1::numeric),  -- MICRO SWITCH
  ('57632184-e0d1-40c1-bb14-4d86baa1884b'::uuid, 2::numeric),  -- MICRO SWITCH WITH ROLLER
  ('89369d90-728a-40b9-9650-c270a1a109ee'::uuid, 2::numeric),  -- M12X100MM DIN 7991 CSK CAP SCREW
  ('adcfb074-650f-4e23-8198-4485d944b3b0'::uuid, 4::numeric),  -- LOAD WHEEL
  ('07bdea27-d38c-48d7-ae41-40f138bb407e'::uuid, 5::numeric),  -- NIPPLE 3/8 X 1.0 [1/8'''' BSP STR GREASE NIPPLE]
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 2::numeric),  -- OIL FILTER 1631 [O-PC15]
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 4::numeric),  -- OIL FILTER 1636
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 7::numeric),  -- OIL FILTER 1637
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 2::numeric),  -- OIL PAN NUT GASKET @ FITING 12X23.5
  ('0120c236-24dd-4584-8690-80805d649487'::uuid, 2::numeric),  -- P/S MOTOR CARBON BRUSH  NUT
  ('1f1914bf-2c1b-4811-a717-edafb56e396c'::uuid, 1::numeric),  -- P/S MOTOR SCREW
  ('b5675fac-1fa1-41d7-862c-796ee6e0e311'::uuid, 1::numeric),  -- PIN 5X20
  ('03849021-ed11-4d8c-9126-a0d2053f54ba'::uuid, 1::numeric),  -- PIN 8X20
  ('b8ed3ee3-75ff-41cd-a79c-38131f071795'::uuid, 1::numeric),  -- PARKING BRAKE SPRING 6FBRE[1.6MM T X 13MM OD X 37MM BL X 75MM TL
  ('17452f17-ec99-451d-a730-0ee3f4d9a7cf'::uuid, 1::numeric),  -- PENNZOIL GEAR PLUS 80W90 1L PREMIUM MINERAL
  ('18c5a379-3b35-4ecf-86b9-95433b941e43'::uuid, 1::numeric),  -- PARKING BRAKE RUBBER (PEDAL)
  ('f0676d75-cb33-4c0b-857a-a7ec737211ac'::uuid, 2::numeric),  -- ROCKER [TVH7253441] - BUTTERFLY PT/STACKER LH
  ('524ecaf3-8a61-477b-9b82-f59b11a521b3'::uuid, 2::numeric),  -- ROCKER [TVH7253448] - BUTTERFLY PT/STACKER RH
  ('e3bccef0-7fc7-4d42-aa83-e53494c3c391'::uuid, 2::numeric),  -- RECOATING BT STACKER SUPPORT WHEEL 127MMX90MMX55MM
  ('4661dcdd-3cb1-4acc-98c0-0a2c99a303af'::uuid, 1::numeric),  -- RECOATING BT STACKER SUPPORT WHEEL 127MMX90MMX50MM
  ('1c76b403-c9de-4884-88ea-4f9fe3a9255c'::uuid, 2::numeric),  -- REAR HUB SCREW (1.0 - 1.8TON)
  ('6bb86f58-0816-4238-ad4d-9945d7990bd4'::uuid, 1::numeric),  -- RELAY [12V-40A-5PIN] TRILUX
  ('4e216078-150e-4ecd-9be2-667c9fcd9ca4'::uuid, 1::numeric),  -- REMA320-MALE 70MM2
  ('b6b4e2e9-e08f-4895-9c1e-b70d8c85a59f'::uuid, 6::numeric),  -- REAR HUB SCREW (2.0 - 2.5TON)
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 32::numeric),  -- SHELL RIMULA R4PLUS 15W40 [209L] @ DIESEL ENGINE OIL
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 3.5::numeric),  -- SHELL SPIRAX S2 G 90 [209L] @ GEAR OIL 90
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 8::numeric),  -- SHELL TELLUS S2 MX 68 [209L] @ HYDRAULIC OIL
  ('65972951-8907-437d-b90a-26cc93ee3cdf'::uuid, 2::numeric),  -- SIDE MIRROR [PIN]
  ('84ea055d-5b97-45d8-b3c2-09d4cebff5ab'::uuid, 6::numeric),  -- SHIM SPECIAL SHAPE 0.3
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 6::numeric),  -- SIGNAL BULB 1142 [48V] TW [2 PIN]
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 10::numeric),  -- SIGNAL REVERSE BULB 1141 [12V] STL
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),  -- SPARK PLUG W16EX-U
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 2::numeric),  -- SPRAY N10
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),  -- STARTER SUB ASSY 5/6/7/8FG 10-30
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),  -- STARTER, IDZ, 14Z 62-8FD15-30
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),  -- SWITCH IGNITION @ KEY SWITCH [TOYOTA]
  ('9bf100fe-54be-4b7b-8559-d8bc7fc2ff2e'::uuid, 2::numeric),  -- SIDE SHIFT CABLE BRACKET
  ('790a87fe-ebf0-4a29-adf1-c4f47d53aab1'::uuid, 1::numeric),  -- SIDE SHIFT SPRING
  ('178d422d-d940-47bd-954e-1b641db36e1d'::uuid, 1::numeric),  -- STARTER SWITCH [ST 50]
  ('6b212f82-df7b-47c9-b702-c9ad527e77d1'::uuid, 6::numeric)  -- WHEEL CONE (DRIVE WHEEL WASHER)
) AS v(part_id, quantity);

-- LIM KHER YUAN (BRK 9093): YUAN BRK9093.xlsx - checked 05.05.26 - 42 unique parts
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '4d46cf4b-0833-462a-a845-e1a0f936b6c5'::uuid, 'BRK 9093', 42, 'active', true,
    '77a0f88d-2cc0-4874-8c29-a6c63656d191'::uuid,
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (YUAN BRK9093.xlsx, checked 05.05.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),  -- BATTERY 105D31L / 125D31L [COZZIE]
  ('7c96047f-6e25-4a2f-8e9a-fd86843ec568'::uuid, 4::numeric),  -- BULB 60V 25/10W BAY15D
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 6::numeric),  -- BRAKE BULB 1016 [48V] TW
  ('a9ab71d9-514b-47e1-8184-818ce6df16db'::uuid, 1::numeric),  -- BATTERY TERMINAL(-)
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 2::numeric),  -- BATTERY TERMINAL(+) HX-S018A
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 6::numeric),  -- BRAKE BULB 1016 [12V] TW
  ('162ac8ec-a1db-4aca-a629-e17546c4c2ee'::uuid, 2::numeric),  -- CAGE COVER NUT
  ('8bb4bfda-5137-461e-99a2-3879cf645adf'::uuid, 2::numeric),  -- CARBON BRUSH P/S MOTOR 8X8X21 [BT]
  ('e7541b7a-d649-4dc2-80f4-23290a4eedbd'::uuid, 1::numeric),  -- CABLE LOOM / WIRING HARNESS
  ('4c288f67-7e3b-452a-bfb4-52f1f1217f3e'::uuid, 1::numeric),  -- CABLE LOCK
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 6::numeric),  -- DEEP GROOVE BALL BEARING 6204 2RS @TSSB
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 4::numeric),  -- DEEP GROOVE BALL BEARING 6304 2RS @TSSB
  ('7a2acdd1-f8fa-4655-9c06-932fd6294069'::uuid, 4::numeric),  -- DRAIN PLUG GASKET 25X34
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 2::numeric),  -- FUEL FILTER 1182
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 1::numeric),  -- FUEL FILTER 1182B @ NISSIN
  ('5dc6d365-d804-4275-86f0-e072ee7578d4'::uuid, 2::numeric),  -- FUSE 160A
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 1::numeric),  -- FUSE 100A
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 10::numeric),  -- GRANTT ATF DEX-III [18L]
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 2::numeric),  -- HEAD LAMP BULB (48V) [6/7 FB/FBRE/FBR/ BT]
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 2::numeric),  -- HEAD LAMP H3 BULB [12V]
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 1::numeric),  -- HORN 48V [7FB]
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),  -- LION DISC HORN 12V
  ('8d510242-ee96-4c86-a179-0c5b0ab747b2'::uuid, 1::numeric),  -- JAPAN BATTERY CONNECTOR PLUG (FEMALE) 4POLE 30A-250V
  ('9f1f27c0-5c65-42e7-8b0f-ae6d60e7573d'::uuid, 1::numeric),  -- MICRO SWITCH
  ('9017a3ae-2068-454d-8d07-8ebbf7d43eb9'::uuid, 1::numeric),  -- LONG LEVER WITH ROLLER
  ('89a87ac5-cb7b-44e9-9928-570b9be049ad'::uuid, 2::numeric),  -- LOCK WASHER MB 10
  ('26153f47-f686-4412-b2e7-93797136c1d2'::uuid, 1::numeric),  -- LOCK WASHER
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 2::numeric),  -- OIL FILTER 1631 [O-PC15]
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 1::numeric),  -- OIL FILTER 1636
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 10::numeric),  -- OIL FILTER 1637
  ('03fc24bc-d89f-4222-be9c-b880cfc2fedb'::uuid, 2::numeric),  -- OIL PAN NUT GASKET @ FITING 12X23.5
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 16::numeric),  -- SHELL RIMULA R4PLUS 15W40 [209L] @ DIESEL ENGINE OIL
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 4::numeric),  -- SHELL SPIRAX S2 G 90 [209L] @ GEAR OIL 90
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 20::numeric),  -- SHELL TELLUS S2 MX 68 [209L] @ HYDRAULIC OIL
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 4::numeric),  -- SIGNAL BULB 1141 [48V] VITALITE [1 PIN]
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 4::numeric),  -- SIGNAL REVERSE BULB 1141 [12V] STL
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),  -- STARTER SUB ASSY 5/6/7/8FG 10-30
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),  -- STARTER, IDZ, 14Z 62-8FD15-30
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),  -- SWITCH IGNITION @ KEY SWITCH [TOYOTA]
  ('790a87fe-ebf0-4a29-adf1-c4f47d53aab1'::uuid, 2::numeric),  -- SIDE SHIFT SPRING
  ('9bf100fe-54be-4b7b-8559-d8bc7fc2ff2e'::uuid, 2::numeric),  -- SIDE SHIFT CABLE BRACKET
  ('fc8c2ffd-939e-402e-9844-8c7beca8f960'::uuid, 1::numeric)  -- SHORT LEVER WITH ROLLER
) AS v(part_id, quantity);

-- MUHAMMAD SYAHRIL BIN BAHARUDDIN (VCG 9318): SYAHRIL VCG9318.xlsx - checked 04.05.26 - 102 unique parts
WITH new_van AS (
  INSERT INTO van_stocks (
    technician_id, van_plate, max_items, van_status, is_active,
    created_by_id, created_by_name, notes
  ) VALUES (
    '2047d2b1-3daf-41c4-ab37-933f1ef5cba9'::uuid, 'VCG 9318', 102, 'active', true,
    '77a0f88d-2cc0-4874-8c29-a6c63656d191'::uuid,
    'Admin One',
    'Initial stock imported from Shin''s xlsx checklist (SYAHRIL VCG9318.xlsx, checked 04.05.26).'
  ) RETURNING van_stock_id
)
INSERT INTO van_stock_items (van_stock_id, part_id, quantity, min_quantity, max_quantity, is_core_item)
SELECT new_van.van_stock_id, v.part_id, v.quantity, 1, 5, true
FROM new_van CROSS JOIN (VALUES
  ('74930e04-2589-4d77-b8cb-89278954af54'::uuid, 6::numeric),  -- AIR FILTER [1.5-3.5 TON]
  ('d695560f-e10a-4c27-ace0-35ccedd425ea'::uuid, 1::numeric),  -- AIR FILTER [SMALL]
  ('29182b2b-445a-46fd-ae1b-06d9547b4d8c'::uuid, 1::numeric),  -- ALTERNATOR [1DZ/14Z]
  ('b9c58cb3-5333-49bc-8319-3bba553b47bc'::uuid, 1::numeric),  -- ALTERNATOR SOCKET HX-7320
  ('6324ea5d-c704-4595-ad78-33618a2a7d26'::uuid, 1::numeric),  -- ACCELATOR CABLE [8FG]
  ('36769f9f-9d03-4b04-aaa4-644e80fd352a'::uuid, 2::numeric),  -- BOLT [LOAD WHEEL SCREW]
  ('306658ef-d634-418b-bcd4-3692e40d0767'::uuid, 1::numeric),  -- BATTERY 105D31L / 125D31L [COZZIE]
  ('8ab22413-fd30-408c-ba8c-382c097a1325'::uuid, 1::numeric),  -- BATTERY 55B24LS [FRED]
  ('06780282-c4a1-412c-bcff-b8bf6f7bd500'::uuid, 1::numeric),  -- BATTERY CONNECTOR GREY [SB175-50MM]
  ('ca1405e4-e95a-4e6f-bd4c-b40a973e3b5d'::uuid, 2::numeric),  -- BATTERY CONNECTOR GREY [SB350-70MM]
  ('f7ca06b6-e8c6-44bb-84f1-518f4fb79f41'::uuid, 9::numeric),  -- BRAKE BULB 1016 [48V] TW
  ('7c96047f-6e25-4a2f-8e9a-fd86843ec568'::uuid, 6::numeric),  -- BULB 60V 25/10W BAY15D
  ('d3c164da-d69e-4ad8-832d-5b12e22f72e9'::uuid, 1::numeric),  -- BATTERY TERMINAL(+) HX-S018A
  ('5b3ff89b-aa37-43e4-b732-3008538cc11e'::uuid, 2::numeric),  -- BUSHING[COPPER PIN]POWER TRUCK
  ('af7625db-14f3-40f7-8580-eacbda15d623'::uuid, 2::numeric),  -- BUSH
  ('c7479084-2705-4620-9619-0bb571ba28a8'::uuid, 4::numeric),  -- BRAKE BULB 1016 [12V] TW
  ('f6292a88-9747-468b-a133-e76654089c0a'::uuid, 2::numeric),  -- BULB 1016 [24V] STL
  ('3248bdfa-28b6-4813-af38-0433a3e1864b'::uuid, 2::numeric),  -- BULB 1141 [24V] STL
  ('96430ee5-948e-4d4d-938f-0321071e7127'::uuid, 1::numeric),  -- BUZZER 48V
  ('53191897-d0c0-443f-b759-bf27be13df75'::uuid, 1::numeric),  -- REVERSE HORN BUZZER 12V - 24V
  ('8eb2bf70-d5a6-4d4c-8464-78aa10250a49'::uuid, 2::numeric),  -- BALANCE WHEEL 130X55X50
  ('efa39bb1-a330-44a1-ada6-56e7a61c343a'::uuid, 3::numeric),  -- CABLE LUG 35MM-10
  ('81d71c6d-dfbe-4c6e-ac0b-b33802312272'::uuid, 4::numeric),  -- CABLE LUG 50MM-10
  ('48b02114-a333-4cfb-a60e-9a8099323e42'::uuid, 2::numeric),  -- CONTACT
  ('7c1f5ecf-502b-4d78-a5c9-8ea2ff5261ca'::uuid, 2::numeric),  -- CONTACT
  ('0a3a33f8-700a-4e1e-aa42-ce7bed244eff'::uuid, 1::numeric),  -- CABLE, ACCELATOR 8FD15-30
  ('5c496209-808a-4679-85a0-ae2764fb357c'::uuid, 2::numeric),  -- CARBURATOR IMPCO SPRING
  ('96f60ff4-f5b4-404b-95df-19376a6045c9'::uuid, 2::numeric),  -- CARBURATOR IMPCO SPRING
  ('773bd637-fa00-4a92-834f-e6f677d1dd2c'::uuid, 4::numeric),  -- CARBON BRUSH 25X10X23 [DRIVE MOTOR] BT PT
  ('7f8a9cb4-0125-4b3d-8649-cbb85938fabf'::uuid, 1::numeric),  -- CLUTCH CABLE 8FD/8FG
  ('4e499c32-0399-4728-82db-09bbab0134ae'::uuid, 1::numeric),  -- CLUTCH SPRING - 8S
  ('2f3a983a-5deb-4d5a-be91-b427a00ec64a'::uuid, 1::numeric),  -- CONTROL VALVE LIMIT SWITCH - HORIZONTAL
  ('713841a3-28f4-40e4-9fa9-bcea9901a3f4'::uuid, 1::numeric),  -- CONTROL VALVE LIMIT SWITCH - STRAIGHT
  ('48336d65-466e-4803-bc6c-118ba2d3ea65'::uuid, 1::numeric),  -- COLLER 20X25X74
  ('cf2798b0-39ee-49b8-a56a-b79eac8bfc37'::uuid, 4::numeric),  -- DEEP GROOVE BALL BEARING 6204 2RS @TSSB
  ('96884c9a-717a-46be-8142-90065f926411'::uuid, 4::numeric),  -- DEEP GROOVE BALL BEARING 6304 2RS @TSSB
  ('de5f7ff4-bc26-4e40-9827-fd5225425248'::uuid, 1::numeric),  -- DISTRIBUTOR CAP[1301077]
  ('5efdcfed-938e-43f8-8a4e-dabe01115fa1'::uuid, 2::numeric),  -- EKZOS RUBBER MOUNTING
  ('d0a3d5bd-250a-4093-b962-fdd0ef9a6ae4'::uuid, 2::numeric),  -- FAN BELT 3460
  ('6abebe10-8835-4872-b797-3bf45b0c9964'::uuid, 1::numeric),  -- FAN BELT 5480 IDZ II
  ('9bcb5001-cdbe-41f4-be9e-5a2b5124efc8'::uuid, 2::numeric),  -- FAN BELT 5500
  ('fe7646d2-71cf-4133-a4b3-d6e0094a817e'::uuid, 5::numeric),  -- FUEL FILTER 1182
  ('bfd55ee9-1c0a-46e9-8eb3-8d624e4cff74'::uuid, 4::numeric),  -- FUEL FILTER 1182B @ NISSIN
  ('5dc6d365-d804-4275-86f0-e072ee7578d4'::uuid, 2::numeric),  -- FUSE 160A
  ('c465ea24-6b3c-44f6-8356-f28a398d32c2'::uuid, 1::numeric),  -- FUSE 125A
  ('b1ef16fa-5518-4413-8391-33cc897b074d'::uuid, 1::numeric),  -- FUSE 100A
  ('8d1bf918-6855-425c-96de-5f6e0e227a30'::uuid, 1::numeric),  -- FUSE HOLDER
  ('4df2297b-d2ea-4cff-8ed9-0ca2888edf39'::uuid, 1::numeric),  -- GAS TANK HEAD @ GAS ADAPTOR
  ('df152588-f6e2-4e4a-ae91-1c6979b79d50'::uuid, 5::numeric),  -- GRANTT ATF DEX-III [18L]
  ('3f53a558-0fd6-4eae-91c7-71ce55f9618a'::uuid, 2::numeric),  -- GAS CHAMBER IMPCO
  ('489326d8-44da-4d47-899c-fa8c45ec8ddc'::uuid, 3::numeric),  -- HEAD LAMP BULB (48V) [6/7 FB/FBRE/FBR/ BT]
  ('99c33e63-f932-4b0e-ae49-3347e3df0aec'::uuid, 9::numeric),  -- HEAD LAMP H3 BULB [12V]
  ('675b0e9e-ee00-4c4a-b4eb-c8548422c0a5'::uuid, 4::numeric),  -- HORN CONTACT [7/8FD/G 10-30]
  ('630b5ec1-da65-4b2c-a174-f7fb4e7d2386'::uuid, 4::numeric),  -- HORN CONTACT [6/7FB10-30]
  ('9ad97bb7-56af-445d-9af8-16a54b8db118'::uuid, 2::numeric),  -- HORN 48V [7FB]
  ('d1538619-c078-46e0-9220-22dfa1fc6f19'::uuid, 1::numeric),  -- LION DISC HORN 12V
  ('8fe8b520-f473-43d4-b153-bba5682539a5'::uuid, 1::numeric),  -- HOSE LOWER 8FG-4Y
  ('dea7b11e-9e50-4ba6-b8dc-a8688004cc74'::uuid, 4::numeric),  -- HOSE CLIP 27-51MM NIETZ
  ('cc36531d-3ba8-4755-bd1c-96514cddb48f'::uuid, 1::numeric),  -- HOSE UPPER 8FG-4Y
  ('0c58aac2-0ad3-4224-a2dd-27d0ca2e3201'::uuid, 1::numeric),  -- HE-30 HARDEX 5 MIN METAL EXPOXY [3TON]
  ('8068d52c-7a28-4901-a91c-c31f50f1e432'::uuid, 2::numeric),  -- HORN SWITCH
  ('c9e8ed69-0e71-43a5-8dd8-ff7346ed3a53'::uuid, 1::numeric),  -- LED BEACON LIGHT [ORANGE COLOUR]
  ('db15b8dd-860d-48f9-aae8-8a4ed7155a40'::uuid, 3::numeric),  -- METAL PLUG
  ('86b14247-16d1-4cd0-b2b1-f07343b79f3e'::uuid, 2::numeric),  -- MACHINE COLLER[P/T] 20X76X13
  ('e255c1f2-0541-4549-af35-3ea44a707da7'::uuid, 4::numeric),  -- LOAD WHEEL
  ('33bcdf60-b396-441c-8590-f1f7b3a9cd93'::uuid, 1::numeric),  -- OIL FILTER 1631 [O-PC15]
  ('eb2af1e6-373d-410c-8986-33672affea72'::uuid, 4::numeric),  -- OIL FILTER 1636
  ('b77a9e3d-7449-45b3-b200-9e9331c382d7'::uuid, 12::numeric),  -- OIL FILTER 1637
  ('c3f4af5b-cc53-4789-b118-87e6c270d751'::uuid, 1::numeric),  -- PUSH BUTTON (RED) KENAIDA LA167-D7-11ZS E/STOP
  ('52f0f46a-737e-464d-b267-0cdab6baee41'::uuid, 1::numeric),  -- P/T CONTACTOR COMPLETE
  ('1e105c0a-51fc-42b1-9500-867ead9f1f9e'::uuid, 1::numeric),  -- PLUG WIRE
  ('2fea7c16-b728-4b19-b44b-0202907bc88c'::uuid, 1::numeric),  -- PC VALVE
  ('6bb16593-dcb3-4786-aaf2-ca9cd8902640'::uuid, 1::numeric),  -- PC VALVE RUBBER 4Y
  ('1d3a8d2c-2eb2-49ac-86e8-384babc606d7'::uuid, 1::numeric),  -- RS-625 HARDEX H.GREY SILICONE
  ('a353ae92-60d3-48c1-abd7-1a6574b924af'::uuid, 2::numeric),  -- RELAY 5 PIN 48V 40A
  ('4a16b4ca-b631-4ceb-b3dd-7a3ae0441a76'::uuid, 1::numeric),  -- RECOATING BT DRIVE WHEEL 210MMX150MMX70MM [LNM]
  ('860ae055-f5ee-464d-ac59-0f1ad7b7d11b'::uuid, 1::numeric),  -- RELAY [12V-30A-4PIN] CS-3981-A
  ('1c76b403-c9de-4884-88ea-4f9fe3a9255c'::uuid, 5::numeric),  -- REAR HUB SCREW (1.0 - 1.8TON)
  ('1b6d788a-fc1f-471f-9dce-e8222e35c2ee'::uuid, 1::numeric),  -- RADIATOR HOSE 8S (DIESEL) BOTTOM
  ('6bb86f58-0816-4238-ad4d-9945d7990bd4'::uuid, 2::numeric),  -- RELAY [12V-40A-5PIN] TRILUX
  ('4da96ff9-75c5-4a77-96f4-60eb9f96f15e'::uuid, 2::numeric),  -- REMA 80 - MALE 25MM
  ('9c5861b7-d116-4d29-9536-80d2d16d60ac'::uuid, 1::numeric),  -- REMA160-FEMALE 50MM2
  ('a63fb3c6-4c41-4e57-bb69-ed14c35d6a57'::uuid, 60::numeric),  -- SHELL RIMULA R4PLUS 15W40 [209L] @ DIESEL ENGINE OIL
  ('e48e68ae-4134-4486-9dfd-86a78c74043f'::uuid, 10::numeric),  -- SHELL SPIRAX S2 G 90 [209L] @ GEAR OIL 90
  ('bad61d96-0eb5-4e93-a5fc-b2672ecfcca8'::uuid, 20::numeric),  -- SHELL TELLUS S2 MX 68 [209L] @ HYDRAULIC OIL
  ('65972951-8907-437d-b90a-26cc93ee3cdf'::uuid, 1::numeric),  -- SIDE MIRROR [PIN]
  ('8a3d8165-12f4-4148-a73d-8acdf2be6050'::uuid, 6::numeric),  -- SIGNAL BULB 1141 [48V] VITALITE [1 PIN]
  ('7baf762f-577a-4091-90b6-35801cb2f080'::uuid, 5::numeric),  -- SIGNAL BULB 1142 [48V] TW [2 PIN]
  ('0347d78a-e4c5-45c9-8328-3d581d09924c'::uuid, 10::numeric),  -- SIGNAL REVERSE BULB 1141 [12V] STL
  ('e166acf7-d008-440f-8f9d-8392d3a0dd7c'::uuid, 3::numeric),  -- SPARK PLUG O-RING
  ('62f184fb-71d7-4842-91a4-1834b98a9f8d'::uuid, 4::numeric),  -- SPARK PLUG W16EX-U
  ('4097c0b0-4b55-41fa-a81a-12df62ddd732'::uuid, 6::numeric),  -- SPRAY N10
  ('33b53422-ba02-4d0a-885b-7ad90755d8d0'::uuid, 1::numeric),  -- STARTER SUB ASSY 5/6/7/8FG 10-30
  ('628409de-c935-41d6-8bd5-91ce17928fa2'::uuid, 1::numeric),  -- STARTER, IDZ, 14Z 62-8FD15-30
  ('b3361ac4-864f-403c-82b5-b7fd37326a4d'::uuid, 1::numeric),  -- SWITCH IGNITION @ KEY SWITCH [TOYOTA]
  ('40ef84a5-3bff-49a5-a2d9-929018b1c577'::uuid, 1::numeric),  -- SWITCH STOP LAMP@ BRAKE SWITCH 8S
  ('cb238a4d-799a-4fa3-9e71-036093ab2494'::uuid, 4::numeric),  -- SPRING HORN CONTACT
  ('8956290b-4ec6-4559-999a-714af71cc154'::uuid, 2::numeric),  -- SOCKET UNIVERSAL FOR RELAY 5 PIN 48V / 40A
  ('68902dd8-72c2-4be6-b54e-315f64cb11c0'::uuid, 5::numeric),  -- SCREW LT2200/PPT1600-A
  ('dc3524c5-a12e-4d2e-af20-8101e4c02f26'::uuid, 1::numeric),  -- SUPPORT WHEEL SCREW [PU]
  ('5b074b27-0747-467a-843e-cd440148ff1a'::uuid, 1::numeric),  -- WATER PUMP IDZ
  ('13402805-34bd-4c0d-a083-b35ee1bc4e4f'::uuid, 1::numeric)  -- WATER PUMP (4Y)
) AS v(part_id, quantity);

COMMIT;

-- ============================================
-- Post-apply verification
-- ============================================
DO $$
DECLARE
  v_van_count INTEGER;
  v_item_count INTEGER;
  v_per_van_counts JSONB;
BEGIN
  SELECT COUNT(*) INTO v_van_count FROM van_stocks
   WHERE van_plate IN ('VLG 6232', 'BRL 3628', 'BRK 9093', 'VCG 9318');
  IF v_van_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 new van_stocks rows, got %', v_van_count;
  END IF;

  SELECT COUNT(*) INTO v_item_count
    FROM van_stock_items i
    JOIN van_stocks v USING (van_stock_id)
    WHERE v.van_plate IN ('VLG 6232', 'BRL 3628', 'BRK 9093', 'VCG 9318');
  -- Expected: 89 + 106 + 42 + 102 = 339
  IF v_item_count <> 339 THEN
    RAISE EXCEPTION 'Expected 339 new van_stock_items, got %', v_item_count;
  END IF;

  -- Per-van breakdown
  SELECT jsonb_object_agg(v.van_plate, c) INTO v_per_van_counts FROM (
    SELECT v.van_plate, count(*)::int AS c
    FROM van_stock_items i
    JOIN van_stocks v USING (van_stock_id)
    WHERE v.van_plate IN ('VLG 6232','BRL 3628','BRK 9093','VCG 9318')
    GROUP BY v.van_plate
  ) AS v;

  RAISE NOTICE 'Van Stock 4-more-vans (SHYAN/LUN/YUAN/SYAHRIL) migration applied: % vans, % items, breakdown=%',
               v_van_count, v_item_count, v_per_van_counts;
END $$;
