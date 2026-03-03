#!/usr/bin/env python3
"""
Push ACWER inventory to FT Supabase using curl (bypasses Cloudflare).
"""

import json
import os
import subprocess
import sys
import time

DATA_PATH = "/home/jay/FT/data/acwer-inventory-cleaned.json"
CREDS_PATH = os.path.expanduser("~/clawd/.credentials/supabase-ft.env")
PROJECT_ID = "dljiubrbatmrskrzaazt"

def load_token():
    with open(CREDS_PATH) as f:
        for line in f:
            if line.startswith("SUPABASE_MANAGEMENT_TOKEN="):
                return line.strip().split("=", 1)[1].strip('"').strip("'")
    return None

def run_query(token, sql):
    """Execute SQL via curl."""
    payload = json.dumps({"query": sql})
    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
        "-d", payload
    ], capture_output=True, text=True, timeout=60)
    
    if result.returncode != 0:
        print(f"CURL ERROR: {result.stderr}")
        return None
    
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"JSON ERROR: {result.stdout[:200]}")
        return None

def escape_sql(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''").replace("\\", "\\\\") + "'"

def main():
    token = load_token()
    if not token:
        print("ERROR: No token"); sys.exit(1)
    
    # Load data
    with open(DATA_PATH) as f:
        items = json.load(f)
    print(f"Loaded {len(items)} items")
    
    # Get existing part codes
    result = run_query(token, "SELECT part_code FROM parts;")
    existing_codes = set()
    if result and isinstance(result, list):
        existing_codes = {r["part_code"] for r in result}
    print(f"Existing parts in DB: {len(existing_codes)}")
    
    # Split
    to_update = [i for i in items if i["item_code"] in existing_codes]
    to_insert = [i for i in items if i["item_code"] not in existing_codes]
    print(f"To update: {len(to_update)}, To insert: {len(to_insert)}")
    
    # Update existing
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
        run_query(token, sql)
    if to_update:
        print(f"Updated {len(to_update)} existing parts")
    
    # Insert new in batches
    BATCH_SIZE = 15  # Smaller batches for curl
    inserted = 0
    errors = 0
    total_batches = (len(to_insert) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for batch_num in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[batch_num:batch_num + BATCH_SIZE]
        
        values = []
        for item in batch:
            cost_val = str(item["cost"]) if item["cost"] is not None else "0"
            qty_val = str(int(item["quantity"])) if not item["is_liquid"] else str(item["quantity"])
            unit = "liter" if item["is_liquid"] else "piece"
            
            val = f"""(gen_random_uuid(), {escape_sql(item['part_name'])}, {escape_sql(item['item_code'])}, {escape_sql(item['category'])}, {cost_val}, 0, {qty_val}, {escape_sql(item['bin'])}, {escape_sql(unit)}, {escape_sql(unit)}, {str(item['is_liquid']).lower()}, NOW(), NOW())"""
            values.append(val)
        
        sql = f"""INSERT INTO parts (part_id, part_name, part_code, category, cost_price, sell_price, stock_quantity, location, unit, base_unit, is_liquid, created_at, updated_at) VALUES {', '.join(values)};"""
        
        result = run_query(token, sql)
        if isinstance(result, dict) and ("error" in result or "message" in result):
            errors += len(batch)
            if errors <= 45:
                print(f"  Batch error: {str(result)[:200]}")
        else:
            inserted += len(batch)
        
        batch_idx = batch_num // BATCH_SIZE + 1
        if batch_idx % 20 == 0 or batch_idx == total_batches:
            print(f"  Progress: {batch_idx}/{total_batches} batches — {inserted} inserted, {errors} errors")
        
        time.sleep(0.2)
    
    print(f"\nDone! Inserted: {inserted}, Errors: {errors}")
    
    # Verify
    result = run_query(token, "SELECT COUNT(*) as count FROM parts;")
    if result:
        print(f"Total parts in DB: {result[0]['count']}")
    
    result = run_query(token, "SELECT category, COUNT(*) as count FROM parts GROUP BY category ORDER BY count DESC;")
    if result and isinstance(result, list):
        print("\nCategories in DB:")
        for r in result:
            print(f"  {r['category']:<35} {r['count']:>5}")

if __name__ == "__main__":
    main()
