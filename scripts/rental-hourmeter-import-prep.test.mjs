import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImportPreparationReport,
  extractSerialAndAie,
  normalizeAlias,
  normalizeLooseAlias,
  parseHourmeterSummaryCsvText,
  parseRentalCsvText,
} from './rental-hourmeter-import-lib.mjs';

test('extractSerialAndAie splits combined hourmeter item code', () => {
  assert.deepEqual(extractSerialAndAie('8FD15-62155 (A1291)'), {
    itemCodeRaw: '8FD15-62155 (A1291)',
    serialNumber: '8FD15-62155',
    normalizedSerialNumber: '8FD15-62155',
    aieNumber: 'A1291',
    normalizedAieNumber: 'A1291',
  });
});

test('parseRentalCsvText excludes non-forklift groups from v1', () => {
  const csv = [
    'DELIVERY DATE,LOCATION1,CUSTOMER\'S DEPT,SITE,Item Group,F/L NO[AIE],F/L NO.,Item Code,MONTHLY RENTAL',
    '2025-06-18 00:00:00,20CUBE LOGISTICS SDN BHD,ACP [B23],PKFZ,R-FD,A91,F12,8FD30-93265,1900',
    '2025-06-18 00:00:00,20CUBE LOGISTICS SDN BHD,ACP [B23],PKFZ,R-HPT,A92,F13,HPT-001,200',
  ].join('\n');

  const records = parseRentalCsvText(csv);
  assert.equal(records.length, 2);
  assert.equal(records[0].includeInV1, true);
  assert.equal(records[1].includeInV1, false);
  assert.equal(records[1].excludedReason, 'excluded_item_group');
});

test('parseHourmeterSummaryCsvText reads grouped 4-row summary blocks', () => {
  const csv = [
    'Sheet,CUSTOMER,Location,Item code,Est service date,NEXT target hour,FLUCTUALTION,est daily usage,hourmeter,Dec 2025,Jan 2026,REMAINING DATE',
    'DIESEL,20CUBE LOGISTICS  [AM],PKFZ,8FD15-62155 (A1291),2026-01-20 07:12:15.912000,8151,3.53,3.138728323699422,Current,7651,,',
    'DIESEL,,,,,,,,,2025-08-14 00:00:00,,',
    'DIESEL,,,,,,,,Latest,7771,8194,',
    'DIESEL,,,,,,,,,2025-09-17 00:00:00,2026-02-03 00:00:00,',
  ].join('\n');

  const { records, anomalies } = parseHourmeterSummaryCsvText(csv);
  assert.equal(anomalies.length, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].serialNumber, '8FD15-62155');
  assert.equal(records[0].aieNumber, 'A1291');
  assert.equal(records[0].latestSnapshot.reading, 8194);
  assert.equal(records[0].latestSnapshot.recordedAt, '2026-02-03');
});

test('normalization keeps exact aliases and loosens suggestions separately', () => {
  assert.equal(normalizeAlias('20CUBE LOGISTICS  [AM]'), '20CUBE LOGISTICS [AM]');
  assert.equal(normalizeLooseAlias('20CUBE LOGISTICS  [AM]'), '20CUBE LOGISTICS');
});

test('buildImportPreparationReport classifies unresolved site aliases as manual review', () => {
  const rentalRecords = parseRentalCsvText([
    'DELIVERY DATE,LOCATION1,CUSTOMER\'S DEPT,SITE,Item Group,F/L NO[AIE],F/L NO.,Item Code,MONTHLY RENTAL',
    '2025-06-18 00:00:00,20CUBE LOGISTICS SDN BHD,,PKFZ,R-FD,A91,F12,8FD30-93265,1900',
  ].join('\n'));

  const { records: hourmeterRecords } = parseHourmeterSummaryCsvText([
    'Sheet,CUSTOMER,Location,Item code,Est service date,NEXT target hour,FLUCTUALTION,est daily usage,hourmeter,Dec 2025,REMAINING DATE',
    'DIESEL,20CUBE LOGISTICS  [AM],PKFZ,8FD30-93265 (A91),2026-04-13 17:24:57.345000,10724,2.11,2.1121495327102804,Current,10224,',
    'DIESEL,,,,,,,,,2025-08-20 00:00:00,',
    'DIESEL,,,,,,,,Latest,10450,',
    'DIESEL,,,,,,,,,2025-12-05 00:00:00,',
  ].join('\n'));

  const report = buildImportPreparationReport({
    rentalRecords,
    hourmeterRecords,
    existingState: {
      customers: [{ customer_id: 'cust-1', name: '20CUBE LOGISTICS SDN BHD' }],
      customerSites: [{ site_id: 'site-1', customer_id: 'cust-1', site_name: 'WESTPORT - PKFZ', address: '' }],
      customerAliases: [],
      customerSiteAliases: [],
      forklifts: [],
      activeRentals: [],
    },
  });

  assert.equal(report.summary.manualReviewCount, 1);
  assert.equal(report.reviewBuckets.unresolvedSiteAliases.length, 1);
  assert.equal(report.assets[0].action, 'manual-review');
});

test('buildImportPreparationReport flags hourmeter regressions for manual review', () => {
  const rentalRecords = parseRentalCsvText([
    'DELIVERY DATE,LOCATION1,CUSTOMER\'S DEPT,SITE,Item Group,F/L NO[AIE],F/L NO.,Item Code,MONTHLY RENTAL',
    '2025-06-18 00:00:00,20CUBE LOGISTICS SDN BHD,,WESTPORT - PKFZ,R-FD,A91,F12,8FD30-93265,1900',
  ].join('\n'));

  const { records: hourmeterRecords } = parseHourmeterSummaryCsvText([
    'Sheet,CUSTOMER,Location,Item code,Est service date,NEXT target hour,FLUCTUALTION,est daily usage,hourmeter,Dec 2025,REMAINING DATE',
    'DIESEL,20CUBE LOGISTICS SDN BHD,WESTPORT - PKFZ,8FD30-93265 (A91),2026-04-13 17:24:57.345000,10724,2.11,2.1121495327102804,Current,10224,',
    'DIESEL,,,,,,,,,2025-08-20 00:00:00,',
    'DIESEL,,,,,,,,Latest,10450,',
    'DIESEL,,,,,,,,,2025-12-05 00:00:00,',
  ].join('\n'));

  const report = buildImportPreparationReport({
    rentalRecords,
    hourmeterRecords,
    existingState: {
      customers: [{ customer_id: 'cust-1', name: '20CUBE LOGISTICS SDN BHD' }],
      customerSites: [{ site_id: 'site-1', customer_id: 'cust-1', site_name: 'WESTPORT - PKFZ', address: '' }],
      customerAliases: [],
      customerSiteAliases: [],
      forklifts: [
        {
          forklift_id: 'forklift-1',
          serial_number: '8FD30-93265',
          forklift_no: 'A91',
          hourmeter: 12000,
        },
      ],
      activeRentals: [],
    },
  });

  assert.equal(report.assets[0].action, 'manual-review');
  assert.ok(report.assets[0].reasons.includes('hourmeter_regression'));
});
