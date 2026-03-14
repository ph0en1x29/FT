#!/usr/bin/env node
/**
 * Import ACWER Debtors CSV → FT Supabase
 * Matches customers by name, updates sites (addresses) and contacts (PIC + phone)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = '/home/jay/.openclaw/media/inbound/DEBTORS_DATA_-_Sheet1---1adacf6d-8626-453f-a648-82587e9f995a.csv';
const PROJECT = 'dljiubrbatmrskrzaazt';

// Load token
const envFile = fs.readFileSync(path.join(require('os').homedir(), 'clawd/.credentials/supabase-ft.env'), 'utf8');
let TOKEN = '';
for (const line of envFile.split('\n')) {
  const clean = line.replace(/^export /, '');
  if (clean.startsWith('SUPABASE_MANAGEMENT_TOKEN=')) TOKEN = clean.split('=').slice(1).join('=').replace(/["']/g, '');
}

function queryDB(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.message && parsed.message.includes('ThrottlerException')) {
            console.log('  Rate limited, retrying in 30s...');
            setTimeout(() => queryDB(sql).then(resolve).catch(reject), 30000);
            return;
          }
          resolve(parsed);
        } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return "'" + String(v).replace(/'/g, "''").trim() + "'";
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══ Parse CSV ═══
function parseCSV(text) {
  // Simple CSV parser handling quoted fields
  const lines = text.split('\n');
  const rows = [];
  for (const line of lines) {
    const row = [];
    let inQuote = false, field = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuote = !inQuote; }
      else if (c === ',' && !inQuote) { row.push(field.trim()); field = ''; }
      else { field += c; }
    }
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

// ═══ Parse Debtors Structure ═══
function parseDebtors(rows) {
  // Multi-row: customer name on first row, subsequent rows have sites/contacts
  // Cols: 0=empty, 1=CUSTOMER, 2=SITE, 3=TEL, 4=PIC, 5=SITE(address)
  const customers = [];
  let current = null;
  let currentSite = null;
  
  for (let i = 1; i < rows.length; i++) { // Skip header
    const row = rows[i];
    if (!row || row.length < 3) continue;
    
    const custName = (row[1] || '').trim();
    const siteName = (row[2] || '').trim();
    const tel = (row[3] || '').trim();
    const pic = (row[4] || '').trim();
    const address = (row[5] || '').trim();
    
    // Skip empty rows
    if (!custName && !siteName && !tel && !pic && !address) continue;
    
    // New customer
    if (custName) {
      current = { name: custName, sites: [], contacts: [] };
      customers.push(current);
      currentSite = null;
    }
    
    if (!current) continue;
    
    // Site entry
    if (siteName) {
      currentSite = { name: siteName, address: address || null };
      current.sites.push(currentSite);
    } else if (address && currentSite && !currentSite.address) {
      // Address on continuation row for current site
      currentSite.address = address;
    }
    
    // Contact/PIC entry
    if (pic || tel) {
      current.contacts.push({ 
        name: pic || null, 
        phone: tel || null,
        site: currentSite ? currentSite.name : null
      });
    }
  }
  
  return customers;
}

// ═══ Fuzzy Match ═══
function normalizeForMatch(name) {
  return name.toUpperCase()
    .replace(/\s*\(M\)\s*/g, ' ')
    .replace(/\s*\(MALAYSIA\)\s*/g, ' ')
    .replace(/\s*SDN\.?\s*BHD\.?\s*/g, ' ')
    .replace(/\s*BERHAD\s*/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Manual overrides for tricky/truncated matches
const MANUAL_MATCHES = {
  'CUSTOMER': null,
  'AGILE MATERIALS': 'AGILE MATERIALS',
  'ALTOTEGAS SDN': 'ALTOTEGAS',
  'ASHITA CONNECT': 'ASHITA CONNECT',
  'BCS INTERGRAT': null,
  'BIZSTEEL': 'BIZSTEEL',
  'BONANZA CHEMICAL': 'BONANZA',
  'CARPET & RUGS': 'CARPET & RUGS',
  'CHAMP STEEL': 'CHAMP STEEL',
  'CHENG MENG': 'CHEONG MENG',
  'CKY RECYCLE': 'CKY RECYCLE',
  'DHL GLOBAL': 'DHL GLOBAL FORWARDING',
  'ECOLOGIS': 'ECOLOGIS',
  'ELEGANT TOTAL': 'ELEGANT TOTAL',
  'ENERGY HUB': 'ENERGYHUB',
  'ENG SHENG': null,
  'FIERY PLASTIC': 'FIERY PLASTIC',
  'FLEXI FIBER': 'FLEXI FIBRE',
  'FOCAL MARKETING': 'FOCAL MARKETING',
  'FRABRIC MARKETING': null,
  'FRESENIUS MED': 'FRESENIUS MEDICAL',
  'GIRBAU LAUNDR': 'GIRBAU',
  'GLASFIL POLYMER': 'GLASFIL',
  'GLOVMASTER SD': 'GLOVMASTER',
  'GRAND TEN': 'GRAND TEN',
  'GUPER INTERGRATED': 'GUPER',
  'HEXAPLEX': 'HEXAPLEX',
  'HAI KEE': 'HAI KEE',
  'I POSB': 'I POSB',
  'INTERCONTINENTAL SPECIALTY': 'INTERCONTINENTAL SPECIALTY FATS',
  'INTRALINK TEC': 'INTRALINK',
  'ITG EQUIPMENT': 'ITG EQUIPMENT',
  'JASCON FOOD': 'JASCON',
  'JEBSEN & JESS': 'JEBSEN',
  'JMJ DEVELOPME': 'JMJ DEVELOPMENT',
  'JL FOOD': 'JL FOOD',
  'JORD MALAYSIA': 'JORD MALAYSIA',
  'KAUFMANN FRABRIC &': 'KAUFMANN',
  'KEJURUTERAAN ELEKTRIK': 'KEJURUTERAAN ELEKTRIK',
  'KERRY LOGISTICS': null,
  'KIAN JOO CANPACK': 'KIAN JOO CANPACK',
  'KINETICS': 'KINETICS',
  'KNDC 3': 'KONTENA NASIONAL',
  'LEGASI Z SUFI': 'LEGASI Z SUFI',
  'LINKK BUSWAY SYSTEMS': 'LINKK BUSWAY',
  'MAGIC FOODS S': 'MAGIC FOODS',
  'MILLENIUM': null,
  'MITSUI & FARBRIC MALAYSIA': 'MITSUI-SOKO',
  'MONSIEUR': 'MONSIEUR',
  'MORRISON': 'MORRISON EXPRESS',
  'NEDERMAN': 'NEDERMAN',
  'NICKO JEEP': 'NICKO JEEP',
  'NINE PACKAGING': 'NINE PACKAGING',
  'NIPPON KONPO': 'NIPPON KONPO',
  'OPM UNITED': null,
  'PANTOS LOGIST': 'PANTOS LOGISTICS',
  'PERSATUAN KEBAJIKAN': 'PERSATUAN KEBAJIKAN',
  'PMS CARGO SER': 'PMS CARGO',
  'POSEIDON SOLU': 'POSEIDON',
  'POWERPETS FOO': 'POWERPETS',
  'PRO NETWORK': 'PRO NETWORK',
  'ROUND-THE-WORLD': 'ROUND-THE-',
  'ROYCE PHARMA': 'ROYCE PHARMA',
  'RUL SYNERGY': 'RUL SYNERGY',
  'SAFRAN LANDING': 'SAFRAN LANDING',
  'SKI': 'SKI ED COATING',
  'SKF BEARING': 'SKF BEARING',
  'SLEEP FOCUS': 'SLEEP FOCUS',
  'SONOCO PRODUCTS': 'SONOCO',
  'SOUTHERN TRANSPROT': 'SOUTHERN TRANSPORT',
  'SOY PRODUCT': 'SOY PRODUCTS',
  'SUNTY INDUSTRY': 'SUNTY',
  'SYARIKAT YOONG': null,
  'TAIACE': 'TAIACE',
  'TAMAYA SYNERG': 'TAMAYA',
  'TCM FORKLIFT': 'TCM FORKLIFT',
  'TDK (MALAYSIA)': 'TDK (MALAYSIA)',
  'THERMO COOLING': null,
  'UNITED INDUSTRIAL': 'UNITED INDUSTRIES',
  'VISION VENTURE': 'VISION VENTURE',
  'WATER REVELATION': 'WATER REVELATION',
  'WR DISTRIBUTI': 'WR DISTRIBUTION',
  'WR MANUFACTUR': 'WR MANUFACTURING',
  'YST MULTI': null,
};

function matchCustomer(csvName, dbCustomers) {
  const normCSV = normalizeForMatch(csvName);
  
  if (normCSV === 'CUSTOMER' || normCSV === '') return null;
  
  // Check manual overrides first
  if (MANUAL_MATCHES.hasOwnProperty(csvName)) {
    const override = MANUAL_MATCHES[csvName];
    if (!override) return null;
    return dbCustomers.find(db => normalizeForMatch(db.name).includes(normalizeForMatch(override))) || null;
  }
  
  // Exact normalized match
  for (const db of dbCustomers) {
    if (normalizeForMatch(db.name) === normCSV) return db;
  }
  
  // Starts-with match (CSV names are truncated at ~13 chars)
  for (const db of dbCustomers) {
    const normDB = normalizeForMatch(db.name);
    if (normDB.startsWith(normCSV) || normCSV.startsWith(normDB)) return db;
  }
  
  // First word exact + second word starts-with (handles truncation like "ALTOTEGAS SDN" → "ALTOTEGAS SDN BHD")
  const csvWords = normCSV.split(' ').filter(w => w.length > 1);
  if (csvWords.length >= 1) {
    for (const db of dbCustomers) {
      const normDB = normalizeForMatch(db.name);
      const dbWords = normDB.split(' ').filter(w => w.length > 1);
      if (dbWords[0] === csvWords[0]) {
        // First word matches — good enough for most truncated names
        if (csvWords.length === 1) return db;
        // Check second word starts with
        if (dbWords.length > 1 && csvWords.length > 1 && dbWords[1].startsWith(csvWords[1].substring(0, 3))) return db;
      }
    }
  }
  
  // Contains match
  for (const db of dbCustomers) {
    const normDB = normalizeForMatch(db.name);
    if (normDB.includes(normCSV) || normCSV.includes(normDB)) return db;
  }
  
  // Word-based match: if all CSV words found in DB name
  if (csvWords.length >= 2) {
    for (const db of dbCustomers) {
      const normDB = normalizeForMatch(db.name);
      if (csvWords.every(w => normDB.includes(w))) return db;
    }
  }
  
  return null;
}

// ═══ Main ═══
async function main() {
  console.log(`╔═══════════════════════════════════════════╗`);
  console.log(`║  FT Debtors Import — ${DRY_RUN ? 'DRY RUN' : '  LIVE  '}           ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);
  
  // Load CSV
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvText);
  const debtors = parseDebtors(rows);
  console.log(`Parsed ${debtors.length} customers from CSV`);
  console.log(`Total sites: ${debtors.reduce((s, d) => s + d.sites.length, 0)}`);
  console.log(`Total contacts: ${debtors.reduce((s, d) => s + d.contacts.length, 0)}\n`);
  
  // Load ALL DB customers (including inactive — CSV may reference them)
  const dbCustomers = await queryDB("SELECT customer_id, name, is_active FROM customers ORDER BY name;");
  const dbSites = await queryDB("SELECT site_id, customer_id, site_name, address FROM customer_sites;");
  const dbContacts = await queryDB("SELECT contact_id, customer_id, name, phone FROM customer_contacts;");
  
  console.log(`DB: ${dbCustomers.length} customers, ${dbSites.length} sites, ${dbContacts.length} contacts\n`);
  
  // Build lookup maps
  const sitesByCustomer = {};
  for (const s of dbSites) {
    if (!sitesByCustomer[s.customer_id]) sitesByCustomer[s.customer_id] = [];
    sitesByCustomer[s.customer_id].push(s);
  }
  const contactsByCustomer = {};
  for (const c of dbContacts) {
    if (!contactsByCustomer[c.customer_id]) contactsByCustomer[c.customer_id] = [];
    contactsByCustomer[c.customer_id].push(c);
  }
  
  // Match and prepare
  const matched = [];
  const unmatched = [];
  
  for (const debtor of debtors) {
    const match = matchCustomer(debtor.name, dbCustomers);
    if (match) {
      matched.push({ csv: debtor, db: match });
    } else {
      unmatched.push(debtor.name);
    }
  }
  
  console.log(`━━━ Matching Results ━━━`);
  console.log(`  Matched: ${matched.length} / ${debtors.length}`);
  console.log(`  Unmatched: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log(`  Unmatched names:`);
    for (const n of unmatched) console.log(`    ✗ ${n}`);
  }
  console.log();
  
  // Reactivate inactive customers that appear in CSV
  const reactivateSQL = [];
  for (const { csv, db } of matched) {
    if (db.is_active === false) {
      reactivateSQL.push(`UPDATE customers SET is_active = true WHERE customer_id = '${db.customer_id}';`);
    }
  }
  console.log(`  Customers to reactivate: ${reactivateSQL.length}\n`);
  
  // Prepare SQL operations
  let siteAddressUpdates = 0;
  let newSites = 0;
  let newContacts = 0;
  let contactUpdates = 0;
  
  const siteUpdateSQL = [];
  const siteInsertSQL = [];
  const contactInsertSQL = [];
  
  for (const { csv, db } of matched) {
    const custId = db.customer_id;
    const existingSites = sitesByCustomer[custId] || [];
    const existingContacts = contactsByCustomer[custId] || [];
    
    // Process sites
    for (const site of csv.sites) {
      if (!site.name) continue;
      
      // Find matching existing site
      const normSiteName = site.name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
      const existingSite = existingSites.find(s => {
        const normExisting = (s.site_name || '').toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
        return normExisting === normSiteName || 
               normExisting.includes(normSiteName) || 
               normSiteName.includes(normExisting);
      });
      
      if (existingSite) {
        // Update address if we have one and existing doesn't
        if (site.address && !existingSite.address) {
          siteUpdateSQL.push(`UPDATE customer_sites SET address = ${esc(site.address)}, updated_at = NOW() WHERE site_id = '${existingSite.site_id}';`);
          siteAddressUpdates++;
        }
      } else {
        // New site
        siteInsertSQL.push(`INSERT INTO customer_sites (customer_id, site_name, address, is_active) VALUES ('${custId}', ${esc(site.name)}, ${esc(site.address)}, true);`);
        newSites++;
      }
    }
    
    // Process contacts (PICs)
    for (const contact of csv.contacts) {
      if (!contact.name && !contact.phone) continue;
      
      // Check if contact already exists (by phone or name)
      const normPhone = (contact.phone || '').replace(/[^0-9]/g, '');
      const exists = existingContacts.find(c => {
        if (normPhone && c.phone) {
          const existPhone = c.phone.replace(/[^0-9]/g, '');
          return existPhone === normPhone || existPhone.endsWith(normPhone.slice(-8)) || normPhone.endsWith(existPhone.slice(-8));
        }
        if (contact.name && c.name) {
          return c.name.toUpperCase().trim() === contact.name.toUpperCase().trim();
        }
        return false;
      });
      
      if (!exists) {
        const isPrimary = csv.contacts.indexOf(contact) === 0;
        contactInsertSQL.push(`INSERT INTO customer_contacts (customer_id, name, phone, role, is_primary) VALUES ('${custId}', ${esc(contact.name)}, ${esc(contact.phone)}, ${esc(contact.site || 'PIC')}, ${isPrimary});`);
        newContacts++;
      }
    }
  }
  
  console.log(`━━━ Operations ━━━`);
  console.log(`  Site address updates: ${siteAddressUpdates}`);
  console.log(`  New sites to add: ${newSites}`);
  console.log(`  New contacts to add: ${newContacts}`);
  console.log();
  
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would execute:`);
    console.log(`  ${siteUpdateSQL.length} site updates`);
    console.log(`  ${siteInsertSQL.length} site inserts`);
    console.log(`  ${contactInsertSQL.length} contact inserts`);
    
    // Show samples
    if (siteUpdateSQL.length) { console.log(`\n  Sample site update: ${siteUpdateSQL[0].substring(0, 150)}...`); }
    if (siteInsertSQL.length) { console.log(`  Sample site insert: ${siteInsertSQL[0].substring(0, 150)}...`); }
    if (contactInsertSQL.length) { console.log(`  Sample contact insert: ${contactInsertSQL[0].substring(0, 150)}...`); }
    return;
  }
  
  // Execute in batches
  console.log(`━━━ Executing ━━━`);
  
  // Reactivate customers
  if (reactivateSQL.length) {
    for (let i = 0; i < reactivateSQL.length; i += 50) {
      const batch = reactivateSQL.slice(i, i + 50).join(' ');
      if (!DRY_RUN) await queryDB(batch);
      console.log(`  Reactivated batch ${Math.floor(i/50)+1}: ${Math.min(50, reactivateSQL.length - i)}`);
      await sleep(2000);
    }
  }
  
  // Site address updates
  if (siteUpdateSQL.length) {
    for (let i = 0; i < siteUpdateSQL.length; i += 50) {
      const batch = siteUpdateSQL.slice(i, i + 50).join(' ');
      await queryDB(batch);
      console.log(`  Site updates batch ${Math.floor(i/50)+1}: ${Math.min(50, siteUpdateSQL.length - i)}`);
      await sleep(2000);
    }
  }
  
  // New sites
  if (siteInsertSQL.length) {
    for (let i = 0; i < siteInsertSQL.length; i += 50) {
      const batch = siteInsertSQL.slice(i, i + 50).join(' ');
      await queryDB(batch);
      console.log(`  Site inserts batch ${Math.floor(i/50)+1}: ${Math.min(50, siteInsertSQL.length - i)}`);
      await sleep(2000);
    }
  }
  
  // New contacts
  if (contactInsertSQL.length) {
    for (let i = 0; i < contactInsertSQL.length; i += 50) {
      const batch = contactInsertSQL.slice(i, i + 50).join(' ');
      await queryDB(batch);
      console.log(`  Contact inserts batch ${Math.floor(i/50)+1}: ${Math.min(50, contactInsertSQL.length - i)}`);
      await sleep(2000);
    }
  }
  
  // Verify
  await sleep(3000);
  console.log(`\n━━━ VERIFICATION ━━━`);
  const siteCount = await queryDB("SELECT COUNT(*) as total, COUNT(address) as with_address FROM customer_sites;");
  console.log(`Sites: ${JSON.stringify(siteCount)}`);
  
  await sleep(2000);
  const contactCount = await queryDB("SELECT COUNT(*) as total FROM customer_contacts;");
  console.log(`Contacts: ${JSON.stringify(contactCount)}`);
  
  console.log(`\n✅ Debtors import complete!`);
}

main().catch(console.error);
