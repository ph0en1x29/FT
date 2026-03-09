# Rental + Hourmeter Import Preparation

Last updated: 2026-03-09

This document describes the non-destructive import preparation flow for:

- `/Users/jay/Downloads/Forklifts_On_Rent_Customer_Sites.csv`
- `/Users/jay/Downloads/UPDATED_HOURMETER_AIE1.csv`

The current implementation does **not** import live data. It only prepares schema support, parses the source files, reads the database, and emits a dry-run review report.

## What Was Added

### Migration

Migration file:
- `database/migrations/20260309_rental_hourmeter_import_prep.sql`

It adds:
- `forklifts.current_site_id`
- `forklifts.delivery_date`
- `forklifts.source_item_group`
- `forklift_rentals.site_id`
- `customer_aliases`
- `customer_site_aliases`
- `hourmeter_history.source = 'import'`

It also makes `customer_sites.address` nullable so site names can be staged before addresses are known.

### App Layer

Updated type/service support:
- `CustomerSite.address` is now optional in TypeScript
- `Forklift` includes `current_site_id`, `delivery_date`, `source_item_group`
- `ForkliftRental` includes `site_id`
- rental/forklift services understand the new fields and fall back safely if the migration has not been run yet

### Dry-Run Tooling

Files:
- `scripts/rental-hourmeter-import-prep.mjs`
- `scripts/rental-hourmeter-import-lib.mjs`
- `scripts/rental-hourmeter-import-prep.test.mjs`

Package commands:
- `npm run import:prep:dry-run`
- `npm run test:import-prep`

## Canonical Source Rules

### Rental CSV

The rental CSV is the source of truth for:
- customer linkage
- site linkage
- active rental context
- monthly rental rate
- delivery date
- source item group

Field mapping:
- `Item Code` -> `forklifts.serial_number`
- `F/L NO[AIE]` -> `forklifts.forklift_no`
- `F/L NO.` -> `forklifts.customer_forklift_no`
- `DELIVERY DATE` -> `forklifts.delivery_date`
- `MONTHLY RENTAL` -> `forklift_rentals.monthly_rental_rate`
- `LOCATION1` -> canonical customer lookup
- `SITE` -> canonical site lookup
- `Item Group` -> `forklifts.source_item_group`

Item group handling:
- `R-FD` -> `Diesel`
- `R-FLPG` -> `LPG`
- `R-FB` -> `Battery/Electrical`
- `R-HPT` and `R-EQUIP` are excluded from v1

### Hourmeter CSV

Only the grouped 4-row summary blocks are treated as canonical hourmeter input.

The flat `DEBTORS` / `F/L NO` / `ITEM CODE` section is intentionally ignored for import decisions in v1.

Hourmeter summary rules:
- parse `Item code` strings like `8FD15-62155 (A1291)`
- split to serial number + AIE number
- use the latest non-empty reading/date pair as the proposed current hourmeter snapshot
- map `NEXT target hour` -> `forklifts.next_target_service_hour`
- map `est daily usage` -> `forklifts.avg_daily_usage`
- keep `Est service date` as service-planning metadata

## Dry-Run Output

Default output path:
- `tmp/rental-hourmeter-import-prep-report.json`

The report contains:
- summary counts
- excluded rental rows
- unresolved customer aliases
- unresolved site aliases
- missing identity rows
- one asset record per classified forklift candidate

Each asset is classified as:
- `create`
- `update`
- `manual-review`

Each asset record includes:
- identity keys
- matched existing forklift info if any
- source rows used
- reasons for manual review
- proposed forklift/rental/hourmeter records

## Review Bucket Meaning

### `unresolvedCustomerAliases`

The rental source row found no exact canonical customer and no alias-table match.

Typical cases:
- punctuation differences
- suffix differences such as `SDN BHD` vs `SDN. BHD.`
- source tags like `[AM]`

### `unresolvedSiteAliases`

The customer resolved, but the site name did not match any existing customer site and no site alias row existed.

Typical cases:
- `PKFZ` vs `WESTPORT - PKFZ`
- abbreviated Shah Alam site labels
- source-specific short codes

### `missingIdentityAssets`

The source row had neither a usable serial number nor a usable AIE number, so it cannot be promoted automatically.

## Safety Rules

The dry-run flow never writes to live fleet/rental/hourmeter tables.

The only file it writes is the review report under `tmp/`.

Imported hourmeter values are planned to create `hourmeter_history` entries with source `import`, but that path has **not** been implemented as a live import yet.

## Example Command

```bash
npm run import:prep:dry-run -- \
  --rental-csv /Users/jay/Downloads/Forklifts_On_Rent_Customer_Sites.csv \
  --hourmeter-csv /Users/jay/Downloads/UPDATED_HOURMETER_AIE1.csv \
  --output tmp/rental-hourmeter-import-prep-report.json \
  --email dev@test.com \
  --password Dev123!
```

## Validation Performed

Verified locally:
- `node --test scripts/rental-hourmeter-import-prep.test.mjs`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

The current dry-run against the provided files generates a report successfully and does not import any records.
