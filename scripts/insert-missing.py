#!/usr/bin/env python3
"""Insert the 570 missing parts (had NULL costs)."""
import json, subprocess, time, os

CREDS = os.path.expanduser("~/clawd/.credentials/supabase-ft.env")
PID = "dljiubrbatmrskrzaazt"

def get_token():
    with open(CREDS) as f:
        for l in f:
            if l.startswith("SUPABASE_MANAGEMENT_TOKEN="):
                return l.strip().split("=",1)[1].strip('"').strip("'")

def query(token, sql):
    r = subprocess.run(["curl","-s","-X","POST",
        f"https://api.supabase.com/v1/projects/{PID}/database/query",
        "-H",f"Authorization: Bearer {token}","-H","Content-Type: application/json",
        "-d",json.dumps({"query":sql})], capture_output=True, text=True, timeout=30)
    try: return json.loads(r.stdout)
    except: return {"error": r.stdout[:200]}

def esc(s):
    if s is None: return "''"
    return "'" + str(s).replace("'","''") + "'"

token = get_token()
with open("/tmp/missing-parts.json") as f:
    items = json.load(f)

print(f"Inserting {len(items)} missing parts...")
inserted = 0
errors = 0

for i, item in enumerate(items):
    cost = item["cost"] if item["cost"] is not None else 0
    qty = int(item["quantity"]) if not item["is_liquid"] else item["quantity"]
    unit = "liter" if item["is_liquid"] else "piece"
    
    sql = f"""INSERT INTO parts (part_id, part_name, part_code, category, cost_price, sell_price, stock_quantity, location, unit, base_unit, is_liquid, created_at, updated_at) 
    VALUES (gen_random_uuid(), {esc(item['part_name'])}, {esc(item['item_code'])}, {esc(item['category'])}, {cost}, 0, {qty}, {esc(item['bin'])}, {esc(unit)}, {esc(unit)}, {str(item['is_liquid']).lower()}, NOW(), NOW());"""
    
    result = query(token, sql)
    if isinstance(result, dict) and "message" in result:
        errors += 1
        if errors <= 5:
            print(f"  Error #{errors}: {str(result)[:150]}")
    else:
        inserted += 1
    
    if (i+1) % 50 == 0:
        print(f"  {i+1}/{len(items)} — {inserted} ok, {errors} err")
    time.sleep(0.1)

print(f"\nDone: {inserted} inserted, {errors} errors")
result = query(token, "SELECT COUNT(*) as count FROM parts;")
print(f"Total in DB: {result}")
