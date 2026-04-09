#!/usr/bin/env python3
import csv
import difflib
import json
import re
import sys
import time
import uuid
from datetime import UTC
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

PROJECT_REF = 'dljiubrbatmrskrzaazt'
XLSX_PATH = '/home/jay/.openclaw/media/inbound/RENTAL_LIST_AS_070426---22d7fde0-4ded-4b4d-b46c-bc09424e3b2f.xlsx'
ENV_PATH = '/home/jay/clawd/.credentials/supabase-ft.env'
OUT_DIR = Path('/home/jay/FT/tmp/rental-import')
OUT_DIR.mkdir(parents=True, exist_ok=True)
DRY_RUN = '--live' not in sys.argv


def now_iso():
    return datetime.now(UTC).isoformat()


def today_iso():
    return datetime.now(UTC).date().isoformat()


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def load_env(path):
    vals = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        vals[k.strip()] = v.strip()
    return vals


ENV = load_env(ENV_PATH)
BASE = ENV['SUPABASE_URL'].rstrip('/') + '/rest/v1/'
HEADERS = {
    'apikey': ENV['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {ENV['SUPABASE_SERVICE_ROLE_KEY']}",
    'Content-Type': 'application/json',
}
NS = {
    'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}


def normalize_text(value):
    value = (value or '').upper().strip()
    value = value.replace('&', ' AND ')
    value = re.sub(r'\bSDN\.?\b', ' SDN ', value)
    value = re.sub(r'\bBHD\.?\b', ' BHD ', value)
    value = re.sub(r'\bMALAYSIA\b', ' MALAYSIA ', value)
    value = re.sub(r'[^A-Z0-9]+', ' ', value)
    value = re.sub(r'\s+', ' ', value).strip()
    return value


def excel_date(v):
    try:
        v = float(v)
    except Exception:
        return None
    if v < 1000:
        return None
    return (datetime(1899, 12, 30) + timedelta(days=v)).date().isoformat()


def parse_xlsx(path):
    with zipfile.ZipFile(path) as zf:
        shared = []
        if 'xl/sharedStrings.xml' in zf.namelist():
            root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
            for si in root.findall('a:si', NS):
                shared.append(''.join(t.text or '' for t in si.iterfind('.//a:t', NS)))
        wb = ET.fromstring(zf.read('xl/workbook.xml'))
        rel = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
        rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rel}
        first = wb.find('a:sheets', NS)[0]
        rid = first.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = 'xl/' + rel_map[rid]
        root = ET.fromstring(zf.read(target))
        table = []
        for row in root.findall('.//a:sheetData/a:row', NS):
            vals = {}
            for c in row.findall('a:c', NS):
                ref = c.attrib.get('r', '')
                col = ''.join(ch for ch in ref if ch.isalpha())
                t = c.attrib.get('t')
                v = c.find('a:v', NS)
                val = '' if v is None else (v.text or '')
                if t == 's' and val != '':
                    val = shared[int(val)]
                vals[col] = val
            table.append(vals)
    records = []
    for row in table[2:]:
        record = {
            'date_out': excel_date(row.get('B')),
            'customer_name': str(row.get('C', '')).strip(),
            'site': str(row.get('D', '')).strip(),
            'item_group': str(row.get('E', '')).strip(),
            'forklift_no': str(row.get('F', '')).strip(),
            'type': str(row.get('G', '')).strip(),
            'item_code': str(row.get('H', '')).strip(),
            'monthly_charge': float(row.get('I') or 0),
            'cust_forklift_no': str(row.get('J', '')).strip(),
        }
        if record['customer_name'] and record['forklift_no']:
            records.append(record)
    return records


def api_get(path):
    req = Request(BASE + path, headers={**HEADERS, 'Prefer': 'count=exact'})
    with urlopen(req) as res:
        return json.loads(res.read().decode())


def api_patch(table, filters, payload):
    if DRY_RUN:
        return {'dry_run': True, 'table': table, 'filters': filters, 'payload': payload}
    url = BASE + table + '?' + '&'.join(filters)
    req = Request(url, data=json.dumps(payload).encode(), headers={**HEADERS, 'Prefer': 'return=representation'})
    req.get_method = lambda: 'PATCH'
    with urlopen(req) as res:
        data = res.read().decode()
        return json.loads(data) if data else []


def api_post(table, payload):
    if DRY_RUN:
        return [{'dry_run': True, **payload}]
    req = Request(BASE + table, data=json.dumps(payload).encode(), headers={**HEADERS, 'Prefer': 'return=representation'})
    with urlopen(req) as res:
        data = res.read().decode()
        return json.loads(data) if data else []


def maybe_match(name, options):
    norm = normalize_text(name)
    if norm in options:
        return options[norm], 'exact'
    close = difflib.get_close_matches(norm, list(options.keys()), n=1, cutoff=0.88)
    if close:
        return options[close[0]], 'fuzzy'
    return None, None


print('Loading live FT data...')
forklifts = api_get('forklifts?select=forklift_id,forklift_no,serial_number,status,current_customer_id,current_site_id,site,customer_forklift_no&limit=3000')
customers = api_get('customers?select=customer_id,name,address,is_active,phone,email,notes,contact_person,account_number,registration_no,tax_entity_id,credit_term,agent,phone_secondary&limit=5000')
sites = api_get('customer_sites?select=site_id,customer_id,site_name,address,notes,is_active,latitude,longitude&limit=8000')
rentals = api_get('forklift_rentals?select=rental_id,forklift_id,customer_id,status,start_date,end_date,monthly_rental_rate,site,site_id&status=eq.active&limit=2000')
jobs = api_get('jobs?select=job_id,forklift_id,customer_id,deleted_at,status&forklift_id=not.is.null&limit=5000')

print('Parsing spreadsheet...')
rows = parse_xlsx(XLSX_PATH)

forklift_by_no = {f['forklift_no'].strip().upper(): f for f in forklifts if f.get('forklift_no')}
forklift_by_serial = {normalize_text(f.get('serial_number')): f for f in forklifts if f.get('serial_number')}
customer_by_norm = {normalize_text(c['name']): c for c in customers if c.get('name')}
site_by_key = {(s['customer_id'], normalize_text(s.get('site_name'))): s for s in sites if s.get('site_name')}
active_rental_by_forklift = {r['forklift_id']: r for r in rentals}
job_pairs = {(j.get('forklift_id'), j.get('customer_id')) for j in jobs if j.get('deleted_at') is None and j.get('forklift_id') and j.get('customer_id')}
job_forklifts = {j.get('forklift_id') for j in jobs if j.get('deleted_at') is None and j.get('forklift_id')}

report = []
matched_rows = []
unmatched_rows = []
created_sites = {}
created_customers = {}
created_forklifts = {}

for row in rows:
    match = {
        'row': row,
        'forklift': None,
        'customer': None,
        'site': None,
        'customer_match': None,
        'site_match': None,
        'issues': [],
    }

    forklift = forklift_by_no.get(row['forklift_no'].upper())
    if not forklift and row['item_code']:
        forklift = forklift_by_serial.get(normalize_text(row['item_code'].split('(')[0].strip()))
    if not forklift:
        key = row['forklift_no'].upper()
        if key in created_forklifts:
            forklift = created_forklifts[key]
        else:
            item_code = row['item_code'].split('(')[0].strip()
            item_norm = normalize_text(item_code)
            fuel = 'electric' if 'BATTERY' in row['type'].upper() or 'ELECTRICAL' in row['type'].upper() or row['item_group'].upper() == 'R-FB' else 'diesel'
            payload = {
                'forklift_id': str(uuid.uuid4()),
                'serial_number': item_code or row['forklift_no'],
                'make': 'Toyota',
                'model': item_code.split('-')[0] if item_code else row['type'].title(),
                'type': row['type'].title() if row['type'] else ('Battery/Electrical' if fuel == 'electric' else 'Diesel'),
                'hourmeter': 0,
                'status': 'Rented Out',
                'ownership': 'company',
                'forklift_no': row['forklift_no'],
                'customer_forklift_no': row['cust_forklift_no'] or None,
                'source_item_group': row['item_group'] or None,
                'ownership_type': 'fleet',
                'notes': 'Created by smart rental importer from client rental sheet',
                'site': row['site'] or None,
                'fuel_type': fuel,
            }
            forklift = api_post('forklifts', payload)[0]
            created_forklifts[key] = forklift
            forklift_by_no[key] = forklift
            if item_norm:
                forklift_by_serial[item_norm] = forklift
    if not forklift:
        match['issues'].append('missing_forklift')
    else:
        match['forklift'] = forklift

    customer, customer_match = maybe_match(row['customer_name'], customer_by_norm)
    if not customer:
        key = normalize_text(row['customer_name'])
        if key in created_customers:
            customer = created_customers[key]
            customer_match = 'created'
        else:
            payload = {
                'customer_id': str(uuid.uuid4()),
                'name': row['customer_name'].strip(),
                'address': row['site'].strip() or None,
                'is_active': True,
            }
            created = api_post('customers', payload)[0]
            created_customers[key] = created
            customer_by_norm[key] = created
            customer = created
            customer_match = 'created'
    match['customer'] = customer
    match['customer_match'] = customer_match

    if customer and row['site']:
        site_key = (customer['customer_id'], normalize_text(row['site']))
        site = site_by_key.get(site_key) or created_sites.get(site_key)
        site_match = 'exact' if site else None
        if not site:
            sibling_names = [k[1] for k in site_by_key.keys() if k[0] == customer['customer_id']]
            close = difflib.get_close_matches(normalize_text(row['site']), sibling_names, n=1, cutoff=0.9)
            if close:
                site = site_by_key[(customer['customer_id'], close[0])]
                site_match = 'fuzzy'
            else:
                payload = {
                    'site_id': str(uuid.uuid4()),
                    'customer_id': customer['customer_id'],
                    'site_name': row['site'].strip(),
                    'address': None,
                    'notes': 'Created by smart rental importer',
                    'is_active': True,
                }
                site = api_post('customer_sites', payload)[0]
                created_sites[site_key] = site
                site_by_key[site_key] = site
                site_match = 'created'
        match['site'] = site
        match['site_match'] = site_match

    if match['forklift'] and match['customer']:
        matched_rows.append(match)
    else:
        unmatched_rows.append(match)
    report.append(match)

keep_rentals = []
end_rentals = []
for rental in rentals:
    pair = (rental.get('forklift_id'), rental.get('customer_id'))
    if pair in job_pairs or rental.get('forklift_id') in job_forklifts:
        keep_rentals.append(rental)
    else:
        end_rentals.append(rental)

incoming_by_forklift = {m['forklift']['forklift_id']: m for m in matched_rows if m['forklift']}
update_actions = []
insert_actions = []
for forklift_id, match in incoming_by_forklift.items():
    existing = active_rental_by_forklift.get(forklift_id)
    desired = {
        'customer_id': match['customer']['customer_id'],
        'start_date': match['row']['date_out'] or today_iso(),
        'monthly_rental_rate': match['row']['monthly_charge'],
        'site': match['row']['site'] or None,
        'site_id': match['site']['site_id'] if match['site'] else None,
        'rental_location': match['customer'].get('address'),
        'status': 'active',
        'currency': 'RM',
        'notes': None,
    }
    if existing:
        update_actions.append((existing, desired, match))
    else:
        insert_actions.append((desired, match))

summary = {
    'dry_run': DRY_RUN,
    'spreadsheet_rows': len(rows),
    'matched_rows': len(matched_rows),
    'unmatched_rows': len(unmatched_rows),
    'active_rentals_before': len(rentals),
    'rentals_to_keep_due_to_jobs': len(keep_rentals),
    'rentals_to_end_no_jobs': len(end_rentals),
    'rentals_to_update': len(update_actions),
    'rentals_to_insert': len(insert_actions),
    'customers_created': len([m for m in matched_rows if m['customer_match'] == 'created']),
    'sites_created': len([m for m in matched_rows if m['site_match'] == 'created']),
    'forklifts_created': len(created_forklifts),
    'fuzzy_customers': len([m for m in matched_rows if m['customer_match'] == 'fuzzy']),
    'fuzzy_sites': len([m for m in matched_rows if m['site_match'] == 'fuzzy']),
}

(Path(OUT_DIR / 'summary.json')).write_text(json.dumps(summary, indent=2))
(Path(OUT_DIR / 'unmatched.json')).write_text(json.dumps(unmatched_rows[:500], indent=2))
with (OUT_DIR / 'unmatched.csv').open('w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['forklift_no', 'item_code', 'customer_name', 'site', 'issues'])
    for item in unmatched_rows:
        writer.writerow([
            item['row']['forklift_no'],
            item['row']['item_code'],
            item['row']['customer_name'],
            item['row']['site'],
            ','.join(item['issues']) or 'resolved_by_create',
        ])

print(json.dumps(summary, indent=2))
print(f"Reports written to {OUT_DIR}")

if DRY_RUN:
    sys.exit(0)

print('Applying live changes...')
print(f"Ending {len(end_rentals)} rentals without jobs...")
for idx, rental in enumerate(end_rentals, 1):
    api_patch('forklift_rentals', [f"rental_id=eq.{quote(rental['rental_id'])}"], {
        'status': 'ended',
        'end_date': today_iso(),
        'ended_at': now_iso(),
        'updated_at': now_iso(),
    })
    api_patch('forklifts', [f"forklift_id=eq.{quote(rental['forklift_id'])}"], {
        'current_customer_id': None,
        'current_site_id': None,
        'status': 'Available',
        'updated_at': now_iso(),
    })
    if idx % 100 == 0 or idx == len(end_rentals):
        print(f"  ended {idx}/{len(end_rentals)}")

print(f"Updating {len(update_actions)} existing rentals...")
for idx, (existing, desired, match) in enumerate(update_actions, 1):
    api_patch('forklift_rentals', [f"rental_id=eq.{quote(existing['rental_id'])}"], {
        **desired,
        'updated_at': now_iso(),
        'end_date': None,
    })
    api_patch('forklifts', [f"forklift_id=eq.{quote(existing['forklift_id'])}"], {
        'current_customer_id': desired['customer_id'],
        'current_site_id': desired['site_id'],
        'status': 'Rented Out',
        'site': desired['site'],
        'customer_forklift_no': match['row']['cust_forklift_no'] or match['forklift'].get('customer_forklift_no'),
        'updated_at': now_iso(),
    })
    if idx % 100 == 0 or idx == len(update_actions):
        print(f"  updated {idx}/{len(update_actions)}")

print(f"Inserting {len(insert_actions)} new rentals...")
for idx, (desired, match) in enumerate(insert_actions, 1):
    rental_id = str(uuid.uuid4())
    api_post('forklift_rentals', {
        'rental_id': rental_id,
        'forklift_id': match['forklift']['forklift_id'],
        **desired,
        'created_at': now_iso(),
        'updated_at': now_iso(),
    })
    api_patch('forklifts', [f"forklift_id=eq.{quote(match['forklift']['forklift_id'])}"], {
        'current_customer_id': desired['customer_id'],
        'current_site_id': desired['site_id'],
        'status': 'Rented Out',
        'site': desired['site'],
        'customer_forklift_no': match['row']['cust_forklift_no'] or match['forklift'].get('customer_forklift_no'),
        'updated_at': now_iso(),
    })
    if idx % 50 == 0 or idx == len(insert_actions):
        print(f"  inserted {idx}/{len(insert_actions)}")

print('Live replacement complete.')
