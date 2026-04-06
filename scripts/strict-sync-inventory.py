#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import time
from decimal import Decimal
from pathlib import Path

DATA_PATH = Path('/home/jay/FT/data/acwer-inventory-cleaned.json')
CREDS_PATH = Path('/home/jay/clawd/.credentials/supabase-ft.env')
PROJECT_ID = 'dljiubrbatmrskrzaazt'


def load_token():
    for line in CREDS_PATH.read_text().splitlines():
        if line.startswith('SUPABASE_MANAGEMENT_TOKEN='):
            return line.split('=', 1)[1].strip().strip('"').strip("'")
    raise RuntimeError('SUPABASE_MANAGEMENT_TOKEN not found')


def run_query(token: str, sql: str, retries: int = 4):
    payload = json.dumps({'query': sql})
    last_error = None
    for attempt in range(retries):
        result = subprocess.run([
            'curl', '-s', '-X', 'POST',
            f'https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query',
            '-H', f'Authorization: Bearer {token}',
            '-H', 'Content-Type: application/json',
            '-d', payload,
        ], capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            last_error = result.stderr
        else:
            try:
                data = json.loads(result.stdout)
            except json.JSONDecodeError as e:
                last_error = f'Bad JSON: {result.stdout[:300]}'
            else:
                if isinstance(data, dict) and (data.get('error') or data.get('message')):
                    message = str(data)
                    if 'connection timeout' in message.lower() or 'upstream connect error' in message.lower():
                        last_error = message
                    else:
                        raise RuntimeError(message)
                else:
                    return data
        if attempt < retries - 1:
            time.sleep(1.0 * (attempt + 1))
    raise RuntimeError(last_error or 'Unknown query failure')


def esc(value):
    if value is None:
        return 'NULL'
    return "'" + str(value).replace('\\', '\\\\').replace("'", "''") + "'"


def num(value):
    if value is None:
        return 'NULL'
    return format(Decimal(str(value)), 'f')


def main():
    token = load_token()
    raw = json.loads(DATA_PATH.read_text())
    items = raw['parts'] if isinstance(raw, dict) and 'parts' in raw else raw
    file_map = {item['item_code']: item for item in items}

    db_rows = run_query(token, 'SELECT part_code, part_name, stock_quantity, cost_price, category, location, is_liquid FROM parts ORDER BY part_code;')
    db_map = {row['part_code']: row for row in db_rows}

    file_codes = set(file_map)
    db_codes = set(db_map)

    extras = sorted(db_codes - file_codes)
    missing = sorted(file_codes - db_codes)
    common = sorted(file_codes & db_codes)

    print(f'File items: {len(file_codes)}')
    print(f'DB items:   {len(db_codes)}')
    print(f'Extras to delete: {len(extras)}')
    print(f'Missing to insert: {len(missing)}')

    undeletable_extras = []
    for code in extras:
        try:
            run_query(token, f'DELETE FROM parts WHERE part_code = {esc(code)};')
        except Exception as e:
            undeletable_extras.append((code, str(e)))

    for code in missing:
        item = file_map[code]
        unit = 'liter' if item.get('is_liquid') else 'piece'
        sql = f"""
        INSERT INTO parts (
            part_id, part_name, part_code, category, cost_price, sell_price,
            stock_quantity, location, unit, base_unit, is_liquid, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), {esc(item.get('part_name'))}, {esc(item.get('item_code'))},
            {esc(item.get('category'))}, {num(item.get('cost'))}, 0,
            {num(item.get('quantity'))}, {esc(item.get('bin'))}, {esc(unit)}, {esc(unit)},
            {str(bool(item.get('is_liquid'))).lower()}, NOW(), NOW()
        );
        """
        run_query(token, sql)

    for idx, code in enumerate(common, start=1):
        item = file_map[code]
        sql = f"""
        UPDATE parts SET
            part_name = {esc(item.get('part_name'))},
            category = {esc(item.get('category'))},
            cost_price = {num(item.get('cost'))},
            stock_quantity = {num(item.get('quantity'))},
            location = {esc(item.get('bin'))},
            is_liquid = {str(bool(item.get('is_liquid'))).lower()},
            updated_at = NOW()
        WHERE part_code = {esc(code)};
        """
        run_query(token, sql)
        if idx % 500 == 0:
            print(f'Updated {idx}/{len(common)} rows...')

    verify_rows = run_query(token, 'SELECT part_code, part_name, stock_quantity, cost_price, category FROM parts ORDER BY part_code;')
    verify_map = {row['part_code']: row for row in verify_rows}
    mismatches = []
    for code, item in file_map.items():
        row = verify_map.get(code)
        if not row:
            mismatches.append((code, 'missing'))
            continue
        if (row['part_name'] or '') != (item.get('part_name') or ''):
            mismatches.append((code, 'name'))
        elif Decimal(str(row['stock_quantity'])) != Decimal(str(item.get('quantity') or 0)):
            mismatches.append((code, 'quantity'))
        elif Decimal(str(row['cost_price'])) != Decimal(str(item.get('cost') or 0)):
            mismatches.append((code, 'cost'))
        elif (row['category'] or '') != (item.get('category') or ''):
            mismatches.append((code, 'category'))
    extra_after = sorted(set(verify_map) - set(file_map))
    print(f'Post-sync mismatches: {len(mismatches)}')
    print(f'Post-sync extra rows: {len(extra_after)}')
    if mismatches[:10]:
        print('Mismatch sample:', mismatches[:10])
    if extra_after[:10]:
        print('Extra sample:', extra_after[:10])
    if undeletable_extras:
        print('Undeletable extras due to FK/history:')
        for code, err in undeletable_extras[:10]:
            print(f'  {code}: {err}')
    if mismatches:
        sys.exit(2)
    if extra_after:
        sys.exit(3)
    print('Strict sync complete. DB matches file exactly on code/name/quantity/cost/category.')


if __name__ == '__main__':
    main()
