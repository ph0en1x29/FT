#!/usr/bin/env python3
"""
Push cleaned ACWER inventory to FT Supabase database.
- Updates existing parts (preserves part_id for FK refs)
- Inserts new parts
- Batches to avoid query size limits
"""

import json
import os
import subprocess
import sys
import time

DATA_PATH = "/home/jay/FT/data/acwer-inventory-cleaned.json"
CREDS_PATH = os.path.expanduser("~/clawd/.credentials/supabase-ft.env")
PROJECT_ID = "dljiubrbatmrskrzaazt"

def load_env():
    """Load Supabase token from env file."""
    token = None
    with open(CREDS_PATH) as f:
        for line in f:
            if line.startswith("SUPABASE_MANAGEMENT_TOKEN="):
                token = line.strip().split("=", 1)[1].strip('"').strip("'")
    return token

def run_query(token, sql):
    """Execute SQL via Supabase Management API."""
    import urllib.request
    url = f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query"
    data = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"ERROR: {e}")
        # Try to read error body
        if hasattr(e, 'read'):
            print(f"Response: {e.read().decode()}")
        return None

def escape_sql(s):
    """Escape string for SQL."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''").replace("\\", "\\\\") + "'"

def main():
    token = load_env()
    if not token:
        print("ERROR: Could not load Supabase token")
        sys.exit(1)
    
    # Load cleaned data
    with open(DATA_PATH) as f:
        items = json.load(f)
    
    print(f"Loaded {len(items)} items from cleaned data")
    
    # Get existing part codes
    result = run_query(token, "SELECT part_code FROM parts;")
    existing_codes = set()
    if result:
        existing_codes = {r["part_code"] for r in result}
    print(f"Existing parts in DB: {len(existing_codes)}")
    
    # Split into updates and inserts
    to_update = []
    to_insert = []
    for item in items:
        if item["item_code"] in existing_codes:
            to_update.append(item)
        else:
            to_insert.append(item)
    
    print(f"Parts to update: {len(to_update)}")
    print(f"Parts to insert: {len(to_insert)}")
    
    # Update existing parts
    updated = 0
    for item in to_update:
        cost_val = str(item["cost"]) if item["cost"] is not None else "NULL"
        qty_val = str(int(item["quantity"])) if not item["is_liquid"] else str(item["quantity"])
        sql = f"""UPDATE parts SET 
            category = {escape_sql(item['category'])},
            cost_price = {cost_val},
            stock_quantity = {qty_val},
            location = {escape_sql(item['bin'])},
            is_liquid = {str(item['is_liquid']).lower()},
            updated_at = NOW()
        WHERE part_code = {escape_sql(item['item_code'])};"""
        result = run_query(token, sql)
        updated += 1
    
    if updated:
        print(f"Updated {updated} existing parts")
    
    # Insert new parts in batches
    BATCH_SIZE = 25
    inserted = 0
    total_batches = (len(to_insert) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for batch_num in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[batch_num:batch_num + BATCH_SIZE]
        
        values = []
        for item in batch:
            cost_val = str(item["cost"]) if item["cost"] is not None else "NULL"
            sell_val = "NULL"
            qty_val = str(int(item["quantity"])) if not item["is_liquid"] else str(item["quantity"])
            
            # Determine unit
            if item["is_liquid"]:
                unit = "liter"
                base_unit = "liter"
            else:
                unit = "piece"
                base_unit = "piece"
            
            val = f"""(
                gen_random_uuid(),
                {escape_sql(item['part_name'])},
                {escape_sql(item['item_code'])},
                {escape_sql(item['category'])},
                {cost_val},
                {sell_val},
                {qty_val},
                {escape_sql(item['bin'])},
                {escape_sql(unit)},
                {escape_sql(base_unit)},
                {str(item['is_liquid']).lower()},
                NOW(),
                NOW()
            )"""
            values.append(val)
        
        sql = f"""INSERT INTO parts (
            part_id, part_name, part_code, category, cost_price, sell_price,
            stock_quantity, location, unit, base_unit, is_liquid,
            created_at, updated_at
        ) VALUES {', '.join(values)};"""
        
        result = run_query(token, sql)
        inserted += len(batch)
        batch_idx = batch_num // BATCH_SIZE + 1
        
        if batch_idx % 10 == 0 or batch_idx == total_batches:
            print(f"  Batch {batch_idx}/{total_batches} — {inserted}/{len(to_insert)} inserted")
        
        # Small delay to avoid rate limiting
        time.sleep(0.15)
    
    print(f"\nDone! Inserted {inserted} new parts")
    
    # Verify final count
    result = run_query(token, "SELECT COUNT(*) as count FROM parts;")
    if result:
        print(f"Total parts in DB: {result[0]['count']}")
    
    # Category breakdown
    result = run_query(token, "SELECT category, COUNT(*) as count FROM parts GROUP BY category ORDER BY count DESC;")
    if result:
        print("\nCategory breakdown in DB:")
        for r in result:
            print(f"  {r['category']:<35} {r['count']:>5}")

if __name__ == "__main__":
    main()
