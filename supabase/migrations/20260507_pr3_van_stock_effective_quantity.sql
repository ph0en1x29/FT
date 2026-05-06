-- 2026-05-07 — PR 3: maintained `effective_quantity` column on van_stock_items.
-- Client report (Shin, 5/6 4:48 AM): all liquid items (Gear Oil, Hydraulic Oil, etc.)
-- listed in Van Stock do NOT appear in the part selection menu — verified across 3 vans.
--
-- Root cause: PartsSection.tsx:415 picker filters with `i.quantity > 0`. For liquids,
-- van_stock_items.quantity is forced to 0 by the route_liquid_to_bulk_quantity trigger;
-- real liquid stock lives in container_quantity * parts.container_size + bulk_quantity.
-- The two-line fix in the picker is in PR 3 TS; this migration provides the single
-- source of truth so the picker (and 13+ other liquid-blind reads) can stop reinventing
-- the formula.
--
-- Strategy:
--  • Maintained column `van_stock_items.effective_quantity NUMERIC NOT NULL DEFAULT 0`.
--    BEFORE INSERT/UPDATE trigger keeps it in sync. Generated columns are not viable
--    here because the formula references parts.container_size (cross-table).
--  • Sibling trigger on parts: when is_liquid or container_size changes, re-stamp
--    every van_stock_items row for that part. Otherwise effective_quantity rots.
--  • Backfill: no-op UPDATE forces BEFORE trigger to fire on every row.
--  • Edge: 1 SKU has container_size <= 0; the formula falls back to size = 1 for it.

BEGIN;
SET LOCAL statement_timeout = '120s';

-- 3.1 Column
ALTER TABLE van_stock_items
  ADD COLUMN IF NOT EXISTS effective_quantity NUMERIC NOT NULL DEFAULT 0;

-- 3.2 Per-row trigger
CREATE OR REPLACE FUNCTION public.set_van_stock_effective_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_part parts%ROWTYPE;
        v_size NUMERIC;
BEGIN
  SELECT * INTO v_part FROM parts WHERE part_id = NEW.part_id;
  IF v_part.is_liquid THEN
    -- Fallback to size = 1 when container_size is missing or non-positive (1 SKU).
    v_size := COALESCE(NULLIF(v_part.container_size, 0), 1);
    IF v_size < 0 THEN v_size := 1; END IF;
    NEW.effective_quantity := COALESCE(NEW.container_quantity, 0) * v_size + COALESCE(NEW.bulk_quantity, 0);
  ELSE
    NEW.effective_quantity := COALESCE(NEW.quantity, 0);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_van_stock_effective_quantity ON van_stock_items;
CREATE TRIGGER trg_set_van_stock_effective_quantity
BEFORE INSERT OR UPDATE OF quantity, container_quantity, bulk_quantity, part_id
ON van_stock_items
FOR EACH ROW
EXECUTE FUNCTION set_van_stock_effective_quantity();

-- 3.3 Sibling trigger on parts: re-stamp when liquid attributes change.
CREATE OR REPLACE FUNCTION public.refresh_van_stock_effective_quantity_on_parts_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_liquid       IS DISTINCT FROM OLD.is_liquid
     OR NEW.container_size IS DISTINCT FROM OLD.container_size THEN
    -- Re-stamp affected van_stock_items rows. The no-op UPDATE on a watched column
    -- fires the BEFORE trigger which recomputes effective_quantity using the NEW parts row.
    UPDATE van_stock_items SET quantity = quantity WHERE part_id = NEW.part_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_parts_liquid_attrs_resync ON parts;
CREATE TRIGGER trg_parts_liquid_attrs_resync
AFTER UPDATE OF is_liquid, container_size
ON parts
FOR EACH ROW
EXECUTE FUNCTION refresh_van_stock_effective_quantity_on_parts_change();

-- 3.4 Backfill: write to one of the watched columns so the BEFORE UPDATE OF trigger
-- fires. `quantity = quantity` is a no-op data-wise but counts as a change for trigger
-- routing.
UPDATE van_stock_items SET quantity = quantity;

-- 3.5 Verify backfill correctness.
DO $$
DECLARE n_bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_bad
    FROM van_stock_items vsi
    JOIN parts p USING (part_id)
   WHERE (p.is_liquid AND vsi.effective_quantity <>
            COALESCE(vsi.container_quantity, 0) *
            COALESCE(NULLIF(GREATEST(p.container_size, 0), 0), 1) +
            COALESCE(vsi.bulk_quantity, 0))
      OR (NOT p.is_liquid AND vsi.effective_quantity <> COALESCE(vsi.quantity, 0));
  IF n_bad <> 0 THEN
    RAISE EXCEPTION 'Backfill mismatch: % rows have wrong effective_quantity', n_bad;
  END IF;
  RAISE NOTICE 'effective_quantity backfilled cleanly';
END $$;

-- 3.6 Forensic: how many liquid rows now expose stock that was previously hidden by the
-- picker filter `i.quantity > 0`? (For PR 3 TS swap rationale.)
DO $$
DECLARE n_hidden INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_hidden
    FROM van_stock_items vsi
    JOIN parts p USING (part_id)
   WHERE p.is_liquid AND COALESCE(vsi.quantity, 0) = 0 AND vsi.effective_quantity > 0;
  RAISE NOTICE 'Liquid rows previously hidden from picker (quantity=0, effective>0): %', n_hidden;
END $$;

COMMIT;
