#!/usr/bin/env node
/**
 * FT Data Migration from ACWER XLSX
 * Reads the multi-row xlsx format and imports into Supabase
 * 
 * Usage: node scripts/migrate_xlsx_data.js [--dry-run]
 */

const XLSX = require('/tmp/node_modules/xlsx');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const XLSX_PATH = '/home/jay/.openclaw/media/inbound/UPDATED_HOURMETER_-_AIE1---e22cbd3d-3922-464e-8f0c-75e83e88bd62.xlsx';
const PROJECT = 'dljiubrbatmrskrzaazt';

// Load Supabase token
const envFile = fs.readFileSync(path.join(require('os').homedir(), 'clawd/.credentials/supabase-ft.env'), 'utf8');
let TOKEN = '';
for (const line of envFile.split('\n')) {
  const clean = line.replace(/^export /, '');
  if (clean.startsWith('SUPABASE_MANAGEMENT_TOKEN=')) {
    TOKEN = clean.split('=').slice(1).join('=').replace(/['"]/g, '');
  }
}

// Helpers
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1000) return null;
  const d = new Date((serial - 25569) * 86400000);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function queryDB(sql) {
  if (DRY_RUN) {
    console.log('  [DRY] SQL:', sql.substring(0, 200) + (sql.length > 200 ? '...' : ''));
    return [];
  }
  try {
    const result = execSync(`curl -s -X POST "https://api.supabase.com/v1/projects/${PROJECT}/database/query" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify({ query: sql }))}`, 
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const parsed = JSON.parse(result);
    if (parsed.message && parsed.message.includes('ThrottlerException')) {
      console.log('  Rate limited, waiting 30s...');
      execSync('sleep 30');
      return queryDB(sql);
    }
    return parsed;
  } catch (e) {
    console.error('  Query error:', e.message?.substring(0, 200));
    return { error: true };
  }
}

function sleep(ms) { execSync(`sleep ${ms / 1000}`); }

// ═══════════════════════════════════════
// PARSE XLSX
// ═══════════════════════════════════════
const wb = XLSX.readFile(XLSX_PATH);
console.log(`╔═══════════════════════════════════════════╗`);
console.log(`║  FT XLSX Migration — ${DRY_RUN ? 'DRY RUN' : '  LIVE  '}           ║`);
console.log(`╚═══════════════════════════════════════════╝\n`);

// ── Parse Diesel/LPG (same structure) ──
function parseDieselLPG(sheetName) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  const header = rows[0];
  
  // Month columns: col 10-22, header contains Excel date serials
  const monthCols = [];
  for (let j = 10; j <= 22; j++) {
    if (header[j] && typeof header[j] === 'number') {
      monthCols.push({ col: j, date: excelDateToISO(header[j]) });
    }
  }
  
  const forklifts = [];
  let i = 1;
  while (i < rows.length) {
    const row = rows[i];
    // Forklift data row: has item code in col 4
    if (!row || !row[4] || !String(row[4]).match(/[A-Z0-9]/i)) { i++; continue; }
    
    const itemCode = String(row[4]).trim();
    const serial = itemCode.split(' ')[0].split('(')[0].trim();
    let flNo = '';
    if (itemCode.includes('(') && itemCode.includes(')')) {
      flNo = itemCode.split('(')[1].split(')')[0].trim();
    }
    
    const serviceDateSerial = row[5];
    const serviceDate = excelDateToISO(serviceDateSerial);
    const targetHour = typeof row[6] === 'number' ? Math.round(row[6]) : null;
    const dailyUsage = typeof row[8] === 'number' ? Math.round(row[8] * 100) / 100 : null;
    
    // Current readings (same row, col 10+)
    const readings = [];
    const currentValues = {};
    for (const mc of monthCols) {
      if (row[mc.col] && typeof row[mc.col] === 'number' && row[mc.col] > 100) {
        currentValues[mc.col] = row[mc.col];
      }
    }
    
    // Current dates (next row)
    i++;
    const currentDates = {};
    if (i < rows.length) {
      const dateRow = rows[i];
      if (dateRow) {
        for (const mc of monthCols) {
          if (dateRow[mc.col] && typeof dateRow[mc.col] === 'number') {
            currentDates[mc.col] = excelDateToISO(dateRow[mc.col]);
          }
        }
      }
    }
    
    // Latest label row
    i++;
    const latestValues = {};
    if (i < rows.length) {
      const latRow = rows[i];
      if (latRow && String(latRow[9] || '').includes('Latest')) {
        for (const mc of monthCols) {
          if (latRow[mc.col] && typeof latRow[mc.col] === 'number' && latRow[mc.col] > 100) {
            latestValues[mc.col] = latRow[mc.col];
          }
        }
      }
    }
    
    // Latest dates row
    i++;
    const latestDates = {};
    if (i < rows.length) {
      const dateRow = rows[i];
      if (dateRow) {
        for (const mc of monthCols) {
          if (dateRow[mc.col] && typeof dateRow[mc.col] === 'number') {
            latestDates[mc.col] = excelDateToISO(dateRow[mc.col]);
          }
        }
      }
    }
    
    // Collect all readings
    for (const mc of monthCols) {
      // Prefer Latest (more recent), fall back to Current
      const value = latestValues[mc.col] || currentValues[mc.col];
      const date = latestDates[mc.col] || currentDates[mc.col] || mc.date;
      if (value && date) {
        readings.push({ value: Math.round(value), date });
      }
    }
    
    forklifts.push({ serial, flNo, serviceDate, targetHour, dailyUsage, readings, itemCode });
    i++;
  }
  return forklifts;
}

// ── Parse Battery ──
function parseBattery() {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['BATTERY'], { header: 1 });
  // Header at row index 3
  // Month columns: 6=2025, 7=JAN, 8=FEB, 9=MAR, ...18=DEC
  // Col 19=NEXT SERVICE DATE, 20=REMAINING DAY
  const monthLabels = ['2025', 'Jan-2026', 'Feb-2026', 'Mar-2026', 'Apr-2026', 'May-2026', 'Jun-2026', 'Jul-2026', 'Aug-2026', 'Sep-2026', 'Oct-2026', 'Nov-2026', 'Dec-2026'];
  
  const forklifts = [];
  let i = 4; // First data row
  while (i < rows.length - 1) {
    const dataRow = rows[i];
    const hrsRow = rows[i + 1];
    
    // Data row must have item code in col 2
    if (!dataRow || !dataRow[2] || !String(dataRow[2]).match(/[A-Z0-9]/i)) { i++; continue; }
    
    const serial = String(dataRow[2]).trim();
    const flNo = dataRow[1] ? String(dataRow[1]).trim() : '';
    const customer = dataRow[3] ? String(dataRow[3]).trim() : '';
    const site = dataRow[4] ? String(dataRow[4]).trim() : '';
    const serviceDateSerial = dataRow[19];
    const serviceDate = excelDateToISO(serviceDateSerial);
    
    // Extract readings: dataRow has dates, hrsRow has hours
    const readings = [];
    if (hrsRow) {
      for (let j = 6; j <= 18; j++) {
        const dateSerial = dataRow[j];
        const hours = hrsRow[j];
        if (hours && typeof hours === 'number' && hours > 0) {
          const date = excelDateToISO(dateSerial);
          if (date) {
            readings.push({ value: Math.round(hours), date });
          }
        }
      }
    }
    
    forklifts.push({ serial, flNo, serviceDate, customer, site, readings });
    i += 2;
  }
  return forklifts;
}

// ── Parse HTPA ──
function parseHTPA() {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['HTPA'], { header: 1 });
  // Header at row 0: Site, Description, 2025, JAN-DEC, NEXT SERVICE DATE, REMAINING DAY
  const entries = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[1]) continue;
    
    const site = String(row[0]).trim();
    const description = String(row[1]).trim();
    const serviceDate = excelDateToISO(row[15]); // NEXT SERVICE DATE
    const remainingDays = row[16];
    
    // Service history dates
    const serviceDates = [];
    for (let j = 2; j <= 14; j++) {
      const d = excelDateToISO(row[j]);
      if (d) serviceDates.push(d);
    }
    
    entries.push({ site, description, serviceDate, remainingDays, serviceDates });
  }
  return entries;
}

// ═══════════════════════════════════════
// PARSE ALL DATA
// ═══════════════════════════════════════
const diesel = parseDieselLPG('DIESEL');
const lpg = parseDieselLPG('LPG');
const battery = parseBattery();
const htpa = parseHTPA();

console.log(`Parsed from XLSX:`);
console.log(`  Diesel:  ${diesel.length} forklifts, ${diesel.reduce((s,f) => s + f.readings.length, 0)} readings`);
console.log(`  LPG:     ${lpg.length} forklifts, ${lpg.reduce((s,f) => s + f.readings.length, 0)} readings`);
console.log(`  Battery: ${battery.length} forklifts, ${battery.reduce((s,f) => s + f.readings.length, 0)} readings`);
console.log(`  HTPA:    ${htpa.length} entries`);

// ═══════════════════════════════════════
// EXECUTE MIGRATION
// ═══════════════════════════════════════

// Step 1: Get forklift_id mapping
console.log(`\n━━━ Step 1: Load forklift mapping ━━━`);
const dbForklifts = queryDB("SELECT forklift_id, serial_number, fuel_type FROM forklifts;");
const serialToId = {};
if (Array.isArray(dbForklifts)) {
  for (const f of dbForklifts) serialToId[f.serial_number] = f.forklift_id;
}
console.log(`  ${Object.keys(serialToId).length} forklifts in DB`);

// Step 2: Clear old CSV-imported hourmeter readings
console.log(`\n━━━ Step 2: Clear old CSV readings ━━━`);
queryDB("DELETE FROM hourmeter_readings WHERE notes LIKE '%CSV%';");
sleep(2000);
const remaining = queryDB("SELECT COUNT(*) as cnt FROM hourmeter_readings;");
console.log(`  Readings remaining after cleanup: ${JSON.stringify(remaining)}`);

// Step 3: Update Battery forklifts
console.log(`\n━━━ Step 3: Update Battery forklifts ━━━`);
let batteryUpdated = 0;
const batteryChunks = [];
for (let i = 0; i < battery.length; i += 150) {
  const chunk = battery.slice(i, i + 150);
  const svcCases = [];
  const flCases = [];
  const serials = [];
  
  for (const f of chunk) {
    serials.push(esc(f.serial));
    if (f.serviceDate) svcCases.push(`WHEN serial_number = ${esc(f.serial)} THEN ${esc(f.serviceDate)}::date`);
    if (f.flNo) flCases.push(`WHEN serial_number = ${esc(f.serial)} THEN ${esc(f.flNo)}`);
  }
  
  const sets = [];
  if (svcCases.length) sets.push(`next_service_due = CASE ${svcCases.join(' ')} ELSE next_service_due END`);
  if (flCases.length) sets.push(`customer_forklift_no = CASE ${flCases.join(' ')} ELSE customer_forklift_no END`);
  sets.push('updated_at = NOW()');
  
  queryDB(`UPDATE forklifts SET ${sets.join(', ')} WHERE serial_number IN (${serials.join(',')});`);
  batteryUpdated += chunk.length;
  console.log(`  Batch ${Math.floor(i/150)+1}: ${chunk.length} battery`);
  sleep(1000);
}

// Step 4: Update Diesel/LPG forklifts
console.log(`\n━━━ Step 4: Update Diesel/LPG forklifts ━━━`);
for (const [label, forklifts] of [['Diesel', diesel], ['LPG', lpg]]) {
  const targetCases = [], dailyCases = [], svcCases = [], flCases = [], serials = [];
  
  for (const f of forklifts) {
    serials.push(esc(f.serial));
    if (f.targetHour) targetCases.push(`WHEN serial_number = ${esc(f.serial)} THEN ${f.targetHour}`);
    if (f.dailyUsage) dailyCases.push(`WHEN serial_number = ${esc(f.serial)} THEN ${f.dailyUsage}`);
    if (f.serviceDate) svcCases.push(`WHEN serial_number = ${esc(f.serial)} THEN ${esc(f.serviceDate)}::date`);
    if (f.flNo) flCases.push(`WHEN serial_number = ${esc(f.serial)} THEN ${esc(f.flNo)}`);
  }
  
  const sets = [];
  if (targetCases.length) sets.push(`next_target_service_hour = CASE ${targetCases.join(' ')} ELSE next_target_service_hour END`);
  if (dailyCases.length) sets.push(`avg_daily_usage = CASE ${dailyCases.join(' ')} ELSE avg_daily_usage END`);
  if (svcCases.length) sets.push(`next_service_due = CASE ${svcCases.join(' ')} ELSE next_service_due END`);
  if (flCases.length) sets.push(`customer_forklift_no = CASE ${flCases.join(' ')} ELSE customer_forklift_no END`);
  sets.push('updated_at = NOW()');
  
  queryDB(`UPDATE forklifts SET ${sets.join(', ')} WHERE serial_number IN (${serials.join(',')});`);
  console.log(`  ${label}: ${forklifts.length} updated`);
  sleep(2000);
}

// Step 5: Import hourmeter readings
console.log(`\n━━━ Step 5: Import hourmeter readings ━━━`);
const allReadings = [];

for (const f of battery) {
  const fid = serialToId[f.serial];
  if (!fid) continue;
  for (const r of f.readings) {
    allReadings.push(`('${fid}', ${r.value}, '${r.date}'::timestamptz, 'XLSX Import', false, 'Battery XLSX')`);
  }
}
for (const [label, forklifts] of [['Diesel', diesel], ['LPG', lpg]]) {
  for (const f of forklifts) {
    const fid = serialToId[f.serial];
    if (!fid) continue;
    for (const r of f.readings) {
      allReadings.push(`('${fid}', ${r.value}, '${r.date}'::timestamptz, 'XLSX Import', false, '${label} XLSX')`);
    }
  }
}

console.log(`  Total readings to import: ${allReadings.length}`);

let imported = 0;
for (let i = 0; i < allReadings.length; i += 100) {
  const chunk = allReadings.slice(i, i + 100);
  queryDB(`INSERT INTO hourmeter_readings (forklift_id, hourmeter_value, reading_date, recorded_by_name, is_service_reading, notes) VALUES ${chunk.join(', ')};`);
  imported += chunk.length;
  console.log(`  Batch ${Math.floor(i/100)+1}: ${chunk.length} readings`);
  sleep(1000);
}

// Step 6: Update forklift hourmeters to latest reading
console.log(`\n━━━ Step 6: Update forklift hourmeters ━━━`);
sleep(2000);
queryDB(`
  UPDATE forklifts f SET 
    hourmeter = sub.latest_value,
    last_hourmeter_update = sub.latest_date,
    updated_at = NOW()
  FROM (
    SELECT DISTINCT ON (forklift_id) 
      forklift_id, hourmeter_value as latest_value, reading_date as latest_date
    FROM hourmeter_readings 
    ORDER BY forklift_id, reading_date DESC
  ) sub
  WHERE f.forklift_id = sub.forklift_id;
`);
console.log(`  ✓ Hourmeters synced to latest reading`);

// Step 7: Verify
console.log(`\n━━━ VERIFICATION ━━━`);
sleep(3000);
const fuelTypes = queryDB("SELECT fuel_type, COUNT(*) as cnt FROM forklifts GROUP BY fuel_type ORDER BY cnt DESC;");
console.log(`Fuel types: ${JSON.stringify(fuelTypes)}`);

sleep(2000);
const completeness = queryDB(`SELECT COUNT(*) as total,
  COUNT(CASE WHEN next_service_due IS NOT NULL THEN 1 END) as has_service_date,
  COUNT(CASE WHEN next_target_service_hour > 0 THEN 1 END) as has_target_hour,
  COUNT(CASE WHEN avg_daily_usage != 8 THEN 1 END) as has_real_usage,
  COUNT(CASE WHEN customer_forklift_no IS NOT NULL AND customer_forklift_no != '' THEN 1 END) as has_fl_no,
  COUNT(CASE WHEN hourmeter > 0 THEN 1 END) as has_hourmeter
FROM forklifts;`);
console.log(`Data: ${JSON.stringify(completeness)}`);

sleep(2000);
const readings = queryDB("SELECT COUNT(*) as total, COUNT(DISTINCT forklift_id) as forklifts FROM hourmeter_readings;");
console.log(`Readings: ${JSON.stringify(readings)}`);

console.log(`\n✅ XLSX Migration complete!`);
