#!/usr/bin/env python3
"""
FT Data Migration: Backfill from ACWER CSV exports
===================================================
Fixes:
  1. fuel_type: R-FB → electric, R-FLPG → lpg (keep R-FD as diesel)
  2. Deletes 133 duplicate entries (null source_item_group, 0 relationships)
  3. Backfills next_service_due, next_target_service_hour, avg_daily_usage
  4. Imports hourmeter readings from monthly CSV columns
  5. Backfills customer_forklift_no from CSV FL_No
  6. Adds HTPA equipment as calendar-only entries

Usage:
  python3 scripts/migrate_csv_data.py --dry-run    # Preview SQL (no changes)
  python3 scripts/migrate_csv_data.py              # Execute against Supabase
"""

import csv
import json
import os
import subprocess
import sys
from datetime import datetime, date
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────

CSV_DIR = Path(os.path.expanduser('~/.openclaw/media/inbound'))
BATTERY_CSV = CSV_DIR / 'BATTERY---289c99fe-fd33-4784-a687-745a5e605b6c.csv'
DIESEL_CSV  = CSV_DIR / 'DIESEL---3cd1e9fa-f967-4cc4-bd77-c421bdaced1a.csv'
LPG_CSV     = CSV_DIR / 'LPG---08db2340-57c7-4458-9a89-60dd48649538.csv'
HTPA_CSV    = CSV_DIR / 'HTPA---7b9042e3-4d36-40cf-bce9-569994186318.csv'

SUPABASE_PROJECT = 'dljiubrbatmrskrzaazt'
CRED_FILE = Path(os.path.expanduser('~/clawd/.credentials/supabase-ft.env'))

DRY_RUN = '--dry-run' in sys.argv

# ── Supabase helpers ────────────────────────────────────────────────

def load_token():
    with open(CRED_FILE) as f:
        for line in f:
            if line.startswith('export '):
                line = line[7:]
            if '=' in line:
                k, v = line.strip().split('=', 1)
                os.environ[k] = v.strip('"').strip("'")
    return os.environ['SUPABASE_MANAGEMENT_TOKEN']

TOKEN = load_token()

def query_db(sql):
    """Execute SQL against Supabase Management API."""
    result = subprocess.run([
        'curl', '-s', '-X', 'POST',
        f'https://api.supabase.com/v1/projects/{SUPABASE_PROJECT}/database/query',
        '-H', f'Authorization: Bearer {TOKEN}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps({"query": sql})
    ], capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"  ⚠ DB error: {result.stdout[:200]}")
        return []

def execute_sql(sql, label=""):
    """Execute SQL — or print in dry-run mode."""
    if DRY_RUN:
        print(f"  [DRY RUN] {label}: {sql[:120]}...")
        return True
    result = query_db(sql)
    if isinstance(result, list) and len(result) > 0 and 'error' in str(result):
        print(f"  ⚠ Error in {label}: {result}")
        return False
    return True

def esc(val):
    """Escape a string for SQL."""
    if val is None:
        return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

# ── CSV loaders ─────────────────────────────────────────────────────

def load_battery():
    rows = []
    with open(BATTERY_CSV) as f:
        for row in csv.DictReader(f):
            serial = row['Item_Code'].strip()
            if not serial:
                continue
            
            # Extract hourmeter readings
            readings = []
            # Monthly reading pairs: date + hours
            month_cols = [
                ('2025_Reading_Date', '2025_Hours', 2025, 12),  # baseline
                ('Jan_Reading_Date', 'Jan_Hours', 2026, 1),
                ('Feb_Reading_Date', 'Feb_Hours', 2026, 2),
                ('Mar_Reading_Date', 'Mar_Hours', 2026, 3),
            ]
            for date_col, hrs_col, yr, mo in month_cols:
                d = row.get(date_col, '').strip()
                h = row.get(hrs_col, '').strip()
                if d and h:
                    try:
                        hours = float(h)
                        readings.append({'date': d, 'hours': hours, 'year': yr, 'month': mo})
                    except ValueError:
                        pass
            
            rows.append({
                'serial': serial,
                'fl_no': row.get('FL_No', '').strip(),
                'customer': row.get('Debtors', '').strip(),
                'site': row.get('Site', '').strip(),
                'delivery_date': row.get('Delivery_Date', '').strip(),
                'next_service_date': row.get('Next_Service_Date', '').strip(),
                'remaining_days': row.get('Remaining_Days', '').strip(),
                'readings': readings,
                'type': 'BATTERY',
            })
    return rows

def load_diesel_lpg(csv_path, fuel_type):
    rows = []
    with open(csv_path) as f:
        for row in csv.DictReader(f):
            code = row['Item_Code'].strip()
            if not code:
                continue
            serial = code.split(' ')[0]
            fl_no = ''
            if '(' in code and ')' in code:
                fl_no = code.split('(')[1].split(')')[0]
            elif ' ' in code:
                parts = code.split(' ', 1)
                if len(parts) > 1:
                    fl_no = parts[1].strip()
            
            # Extract hourmeter readings (use Latest_ columns — most recent readings)
            readings = []
            months = [
                ('Dec-2025', 2025, 12),
                ('Jan-2026', 2026, 1),
                ('Feb-2026', 2026, 2),
                ('Mar-2025', 2025, 3),  # Note: CSV has Mar-2025 (likely typo for Mar-2026)
            ]
            for month_key, yr, mo in months:
                # Prefer Latest_ readings (most recent for that month)
                h = row.get(f'Latest_{month_key}', '').strip()
                d = row.get(f'Latest_Date_{month_key}', '').strip()
                if not h or not d:
                    # Fall back to Current_ readings
                    h = row.get(f'Current_{month_key}', '').strip()
                    d = row.get(f'Current_Date_{month_key}', '').strip()
                if h and d:
                    try:
                        hours = float(h)
                        # Fix Mar-2025 → Mar-2026 if date is in 2026
                        actual_yr = yr
                        if '2026' in d:
                            actual_yr = 2026
                        readings.append({'date': d, 'hours': hours, 'year': actual_yr, 'month': mo})
                    except ValueError:
                        pass
            
            # Parse numeric fields
            target_hour = None
            daily_usage = None
            try:
                target_hour = float(row.get('Next_Target_Hour', '').strip())
            except (ValueError, AttributeError):
                pass
            try:
                daily_usage = float(row.get('Est_Daily_Usage', '').strip())
            except (ValueError, AttributeError):
                pass
            
            rows.append({
                'serial': serial,
                'full_code': code,
                'fl_no': fl_no,
                'customer': row.get('Customer', '').strip(),
                'site': row.get('Location', '').strip(),
                'est_service_date': row.get('Est_Service_Date', '').strip(),
                'next_target_hour': target_hour,
                'daily_usage': daily_usage,
                'fluctuation': row.get('Fluctuation', '').strip(),
                'remaining_date': row.get('Remaining_Date', '').strip(),
                'readings': readings,
                'type': fuel_type,
            })
    return rows

def load_htpa():
    rows = []
    with open(HTPA_CSV) as f:
        for row in csv.DictReader(f):
            site = row.get('Site', '').strip()
            desc = row.get('Description', '').strip()
            if not desc:
                continue
            rows.append({
                'site': site,
                'description': desc,
                'next_service_date': row.get('Next_Service_Date', '').strip(),
                'remaining_days': row.get('Remaining_Days', '').strip(),
            })
    return rows

# ── Migration steps ─────────────────────────────────────────────────

def step1_fix_fuel_types():
    """Fix fuel_type based on source_item_group."""
    print("\n━━━ STEP 1: Fix fuel_types ━━━")
    
    sqls = [
        ("R-FB → electric", "UPDATE forklifts SET fuel_type = 'electric' WHERE source_item_group = 'R-FB' AND fuel_type != 'electric';"),
        ("R-FLPG → lpg",    "UPDATE forklifts SET fuel_type = 'lpg' WHERE source_item_group = 'R-FLPG' AND fuel_type != 'lpg';"),
        ("R-FD → diesel",   "UPDATE forklifts SET fuel_type = 'diesel' WHERE source_item_group = 'R-FD' AND fuel_type != 'diesel';"),
    ]
    
    for label, sql in sqls:
        print(f"  {label}")
        execute_sql(sql, label)
    
    # Verify
    if not DRY_RUN:
        result = query_db("SELECT fuel_type, COUNT(*) as cnt FROM forklifts WHERE source_item_group IS NOT NULL GROUP BY fuel_type ORDER BY fuel_type;")
        print(f"  ✓ Verification: {result}")

def step2_delete_duplicates():
    """Delete 133 null source_item_group entries (verified 0 relationships)."""
    print("\n━━━ STEP 2: Delete duplicates (null source_item_group) ━━━")
    
    # Double-check: count relationships
    if not DRY_RUN:
        check = query_db("""
            SELECT 
                (SELECT COUNT(*) FROM jobs j INNER JOIN forklifts f ON j.forklift_id = f.forklift_id WHERE f.source_item_group IS NULL) as jobs,
                (SELECT COUNT(*) FROM hourmeter_readings h INNER JOIN forklifts f ON h.forklift_id = f.forklift_id WHERE f.source_item_group IS NULL) as readings,
                (SELECT COUNT(*) FROM forklift_rentals r INNER JOIN forklifts f ON r.forklift_id = f.forklift_id WHERE f.source_item_group IS NULL) as rentals;
        """)
        total_refs = sum(v for v in check[0].values() if isinstance(v, int))
        if total_refs > 0:
            print(f"  ⚠ ABORT: Found {total_refs} relationships! {check}")
            return
    
    count_before = query_db("SELECT COUNT(*) as cnt FROM forklifts;") if not DRY_RUN else [{'cnt': '?'}]
    
    sql = "DELETE FROM forklifts WHERE source_item_group IS NULL;"
    execute_sql(sql, "delete duplicates")
    
    if not DRY_RUN:
        count_after = query_db("SELECT COUNT(*) as cnt FROM forklifts;")
        print(f"  ✓ Before: {count_before[0]['cnt']} → After: {count_after[0]['cnt']}")

def step3_backfill_battery(battery_data):
    """Backfill Battery forklifts: next_service_due, customer_forklift_no."""
    print("\n━━━ STEP 3: Backfill Battery data ━━━")
    
    updated = 0
    skipped = 0
    
    for row in battery_data:
        serial = row['serial']
        updates = []
        
        if row['next_service_date']:
            updates.append(f"next_service_due = {esc(row['next_service_date'])}")
        
        if row['fl_no']:
            updates.append(f"customer_forklift_no = {esc(row['fl_no'])}")
        
        if not updates:
            skipped += 1
            continue
        
        sql = f"UPDATE forklifts SET {', '.join(updates)}, updated_at = NOW() WHERE serial_number = {esc(serial)};"
        execute_sql(sql, f"battery {serial}")
        updated += 1
    
    print(f"  ✓ Updated: {updated}, Skipped (no data): {skipped}")

def step4_backfill_diesel_lpg(diesel_data, lpg_data):
    """Backfill Diesel/LPG: next_target_service_hour, avg_daily_usage, next_service_due, customer_forklift_no."""
    print("\n━━━ STEP 4: Backfill Diesel/LPG data ━━━")
    
    updated = 0
    skipped = 0
    
    for row in diesel_data + lpg_data:
        serial = row['serial']
        updates = []
        
        if row['next_target_hour'] is not None:
            updates.append(f"next_target_service_hour = {int(row['next_target_hour'])}")
        
        if row['daily_usage'] is not None:
            updates.append(f"avg_daily_usage = {row['daily_usage']}")
        
        if row['est_service_date']:
            # Parse the date — could be "2026-05-09 01:43:55" or "2026-08-22"
            date_str = row['est_service_date'].split(' ')[0] if ' ' in row['est_service_date'] else row['est_service_date']
            try:
                # Validate it's a real date
                datetime.strptime(date_str, '%Y-%m-%d')
                updates.append(f"next_service_due = {esc(date_str)}")
            except ValueError:
                pass
        
        if row['fl_no']:
            updates.append(f"customer_forklift_no = {esc(row['fl_no'])}")
        
        if not updates:
            skipped += 1
            continue
        
        sql = f"UPDATE forklifts SET {', '.join(updates)}, updated_at = NOW() WHERE serial_number = {esc(serial)};"
        execute_sql(sql, f"{row['type'].lower()} {serial}")
        updated += 1
    
    print(f"  ✓ Updated: {updated}, Skipped: {skipped}")

def step5_import_hourmeter_readings(battery_data, diesel_data, lpg_data):
    """Import hourmeter readings from CSV monthly columns."""
    print("\n━━━ STEP 5: Import hourmeter readings ━━━")
    
    # First get forklift_id mapping
    if DRY_RUN:
        print("  [DRY RUN] Would import readings for all forklifts with monthly data")
        total = sum(len(r['readings']) for r in battery_data + diesel_data + lpg_data)
        print(f"  [DRY RUN] Total readings to import: {total}")
        return
    
    db_forklifts = query_db("SELECT forklift_id, serial_number FROM forklifts;")
    serial_to_id = {r['serial_number']: r['forklift_id'] for r in db_forklifts}
    
    inserted = 0
    skipped = 0
    errors = 0
    batch_values = []
    
    all_data = battery_data + diesel_data + lpg_data
    
    for row in all_data:
        serial = row['serial']
        fid = serial_to_id.get(serial)
        if not fid:
            skipped += 1
            continue
        
        for reading in row['readings']:
            try:
                date_str = reading['date']
                hours = reading['hours']
                
                if hours <= 0:
                    continue
                
                # Validate date
                try:
                    datetime.strptime(date_str, '%Y-%m-%d')
                except ValueError:
                    # Try other date formats
                    for fmt in ['%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d']:
                        try:
                            dt = datetime.strptime(date_str, fmt)
                            date_str = dt.strftime('%Y-%m-%d')
                            break
                        except ValueError:
                            continue
                    else:
                        skipped += 1
                        continue
                
                batch_values.append(
                    f"('{fid}', {hours}, '{date_str}', NULL, 'CSV Import', false, 'Imported from ACWER spreadsheet')"
                )
                inserted += 1
            except Exception as e:
                errors += 1
    
    # Batch insert in chunks of 100
    if batch_values:
        for i in range(0, len(batch_values), 100):
            chunk = batch_values[i:i+100]
            sql = f"""
                INSERT INTO hourmeter_readings 
                    (forklift_id, hourmeter_value, reading_date, recorded_by_id, recorded_by_name, is_service_reading, notes)
                VALUES {', '.join(chunk)}
                ON CONFLICT DO NOTHING;
            """
            result = query_db(sql)
            if isinstance(result, list) and result and 'error' in str(result).lower():
                print(f"  ⚠ Batch error at {i}: {str(result)[:100]}")
                errors += 1
    
    # Also update each forklift's hourmeter to the latest reading
    print("  Updating forklift hourmeter to latest reading...")
    update_sql = """
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
        WHERE f.forklift_id = sub.forklift_id
        AND (f.hourmeter IS NULL OR f.hourmeter = 0 OR sub.latest_value > f.hourmeter);
    """
    query_db(update_sql)
    
    print(f"  ✓ Inserted: {inserted} readings, Skipped: {skipped}, Errors: {errors}")

def step6_htpa(htpa_data):
    """Add HTPA equipment to forklifts table (calendar-only, no hourmeter)."""
    print("\n━━━ STEP 6: Import HTPA equipment ━━━")
    
    if DRY_RUN:
        print(f"  [DRY RUN] Would import {len(htpa_data)} HTPA entries")
        return
    
    # Check which HTPA entries already exist (by matching description as serial_number)
    inserted = 0
    skipped = 0
    
    for row in htpa_data:
        # Use description code as unique identifier (e.g., "180039 - GRO 3")
        desc = row['description']
        site = row['site']
        serial = f"HTPA-{desc.split(' - ')[0].strip()}" if ' - ' in desc else f"HTPA-{desc[:20]}"
        
        # Check if already exists
        existing = query_db(f"SELECT forklift_id FROM forklifts WHERE serial_number = {esc(serial)};")
        if existing:
            # Update next_service_due
            if row['next_service_date']:
                query_db(f"UPDATE forklifts SET next_service_due = {esc(row['next_service_date'])}, updated_at = NOW() WHERE serial_number = {esc(serial)};")
            skipped += 1
            continue
        
        # Determine equipment type from description
        equip_type = 'HTPA'
        equip_name = desc.split(' - ')[1].strip() if ' - ' in desc else desc
        
        # Look up AEON BIG customer_id
        aeon_customer = query_db("SELECT customer_id FROM customers WHERE LOWER(name) LIKE '%aeon%' LIMIT 1;")
        customer_id = aeon_customer[0]['customer_id'] if aeon_customer else None
        
        sql = f"""
            INSERT INTO forklifts (
                serial_number, type, fuel_type, site, status,
                next_service_due, source_item_group, customer_forklift_no,
                notes, created_at, updated_at
                {', customer_id' if customer_id else ''}
            ) VALUES (
                {esc(serial)}, 'HTPA', 'electric', {esc(f'AEON BIG {site}')}, 'Active',
                {esc(row['next_service_date']) if row['next_service_date'] else 'NULL'}, 
                'HTPA', {esc(equip_name)},
                {esc(f'HTPA equipment at AEON BIG {site}: {desc}')},
                NOW(), NOW()
                {f", '{customer_id}'" if customer_id else ''}
            );
        """
        query_db(sql)
        inserted += 1
    
    print(f"  ✓ Inserted: {inserted}, Updated: {skipped}")

def step7_verify():
    """Run verification queries."""
    print("\n━━━ STEP 7: Verification ━━━")
    
    if DRY_RUN:
        print("  [DRY RUN] Skipping verification")
        return
    
    # Fuel type distribution
    result = query_db("SELECT fuel_type, COUNT(*) as cnt FROM forklifts GROUP BY fuel_type ORDER BY cnt DESC;")
    print(f"  Fuel types: {result}")
    
    # Data completeness
    result = query_db("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN next_service_due IS NOT NULL THEN 1 END) as has_service_date,
            COUNT(CASE WHEN next_target_service_hour IS NOT NULL AND next_target_service_hour > 0 THEN 1 END) as has_target_hour,
            COUNT(CASE WHEN avg_daily_usage IS NOT NULL AND avg_daily_usage != 8 THEN 1 END) as has_real_usage,
            COUNT(CASE WHEN customer_forklift_no IS NOT NULL AND customer_forklift_no != '' THEN 1 END) as has_fl_no,
            COUNT(CASE WHEN hourmeter > 0 THEN 1 END) as has_hourmeter
        FROM forklifts;
    """)
    print(f"  Data completeness: {result}")
    
    # Hourmeter readings count
    result = query_db("SELECT COUNT(*) as total, COUNT(DISTINCT forklift_id) as forklifts FROM hourmeter_readings;")
    print(f"  Hourmeter readings: {result}")
    
    # Duplicates check
    result = query_db("SELECT COUNT(*) as cnt FROM forklifts WHERE source_item_group IS NULL;")
    print(f"  Null source_item_group (should be 0): {result}")

# ── Main ────────────────────────────────────────────────────────────

def main():
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    print(f"╔═══════════════════════════════════════════╗")
    print(f"║  FT Data Migration — {mode:>8}            ║")
    print(f"╚═══════════════════════════════════════════╝")
    
    print("\nLoading CSVs...")
    battery = load_battery()
    diesel = load_diesel_lpg(DIESEL_CSV, 'DIESEL')
    lpg = load_diesel_lpg(LPG_CSV, 'LPG')
    htpa = load_htpa()
    
    print(f"  Battery: {len(battery)} rows ({sum(len(r['readings']) for r in battery)} readings)")
    print(f"  Diesel:  {len(diesel)} rows ({sum(len(r['readings']) for r in diesel)} readings)")
    print(f"  LPG:     {len(lpg)} rows ({sum(len(r['readings']) for r in lpg)} readings)")
    print(f"  HTPA:    {len(htpa)} rows")
    
    step1_fix_fuel_types()
    step2_delete_duplicates()
    step3_backfill_battery(battery)
    step4_backfill_diesel_lpg(diesel, lpg)
    step5_import_hourmeter_readings(battery, diesel, lpg)
    step6_htpa(htpa)
    step7_verify()
    
    print(f"\n{'='*50}")
    if DRY_RUN:
        print("DRY RUN complete. Run without --dry-run to execute.")
    else:
        print("✅ Migration complete!")

if __name__ == '__main__':
    main()
