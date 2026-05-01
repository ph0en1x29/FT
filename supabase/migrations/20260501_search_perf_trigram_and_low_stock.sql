-- =============================================
-- FieldPro Migration: Search performance — trigram indexes + low-stock SQL filter
-- =============================================
-- Date: 2026-05-01
-- Purpose:
--   1. Customer search and parts search both use `ilike '%term%'` across
--      multiple columns. Btree indexes can't serve substring search, so
--      every keystroke (after the 250-300 ms debounce) does a sequential
--      scan. Adding GIN trigram indexes on the highest-value columns lets
--      Postgres use index scans for both forms.
--   2. The "low stock" filter currently loops the entire parts catalog
--      client-side (services/partsService.ts getLowStockPartIds). Adding a
--      generated `effective_stock` column lets the filter run as a single
--      SQL predicate.
-- =============================================

BEGIN;

-- pg_trgm is required for gin_trgm_ops
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Customers: top 5 most-searched columns. The service searches 12 columns
-- but >95% of real searches hit one of these; indexing all 12 would double
-- write cost on every customer update for marginal gain.
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
  ON customers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_account_trgm
  ON customers USING gin (account_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON customers USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_address_trgm
  ON customers USING gin (address gin_trgm_ops);

-- Parts: free-text search hits part_name + part_code in the UI; category
-- and supplier are usually selected via dropdowns, not typed.
CREATE INDEX IF NOT EXISTS idx_parts_name_trgm
  ON parts USING gin (part_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parts_code_trgm
  ON parts USING gin (part_code gin_trgm_ops);

-- Generated column for low-stock filtering. Mirrors isPartLowStock /
-- isPartOutOfStock semantics in services/partsService.ts:
--   - liquid parts:    container_quantity + bulk_quantity
--   - non-liquid:      stock_quantity
ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS effective_stock numeric
    GENERATED ALWAYS AS (
      CASE
        WHEN is_liquid IS TRUE
          THEN COALESCE(container_quantity, 0) + COALESCE(bulk_quantity, 0)
        ELSE COALESCE(stock_quantity, 0)
      END
    ) STORED;

-- Partial index for low-stock predicate. min_stock_level can be NULL — we
-- treat NULL as 10 (matches the JS default in isPartLowStock).
CREATE INDEX IF NOT EXISTS idx_parts_low_stock
  ON parts (effective_stock)
  WHERE effective_stock <= COALESCE(min_stock_level, 10);

-- Index for out-of-stock filter as well (effective_stock = 0)
CREATE INDEX IF NOT EXISTS idx_parts_out_of_stock
  ON parts (effective_stock)
  WHERE effective_stock = 0;

-- RPC for the low-stock part-id list. PostgREST can't express a
-- column-vs-column predicate (effective_stock <= min_stock_level), so
-- expose it as a function. Returns just IDs — caller does a follow-up
-- .in() select to hydrate the page (preserves the existing service shape).
CREATE OR REPLACE FUNCTION get_low_stock_part_ids(
  p_search_query text DEFAULT NULL,
  p_category text DEFAULT NULL
) RETURNS TABLE (part_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.part_id
  FROM parts p
  WHERE p.effective_stock > 0
    AND p.effective_stock <= COALESCE(p.min_stock_level, 10)
    AND (p_category IS NULL OR p_category = 'all' OR p.category = p_category)
    AND (
      p_search_query IS NULL OR p_search_query = ''
      OR p.part_name ILIKE '%' || p_search_query || '%'
      OR p.part_code ILIKE '%' || p_search_query || '%'
    )
  ORDER BY p.category, p.part_name;
$$;

GRANT EXECUTE ON FUNCTION get_low_stock_part_ids(text, text) TO authenticated;

-- Aggregate stats for inventory dashboards. Replaces a client-side loop in
-- getInventoryCatalogStats() that pulled every parts row into the browser
-- and reduced over them.
CREATE OR REPLACE FUNCTION get_inventory_catalog_stats()
RETURNS TABLE (
  total bigint,
  low_stock bigint,
  out_of_stock bigint,
  liquid_mismatch bigint,
  total_value numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (
      WHERE effective_stock > 0
        AND effective_stock <= COALESCE(min_stock_level, 10)
    )::bigint AS low_stock,
    COUNT(*) FILTER (WHERE effective_stock = 0)::bigint AS out_of_stock,
    COUNT(*) FILTER (
      WHERE is_liquid IS TRUE
        AND container_size IS NOT NULL AND container_size > 0
        AND COALESCE(bulk_quantity, 0)
            <> ROUND(COALESCE(bulk_quantity, 0) / container_size) * container_size
    )::bigint AS liquid_mismatch,
    COALESCE(SUM(
      CASE
        WHEN is_liquid IS TRUE
          THEN COALESCE(cost_price, 0) * COALESCE(container_quantity, 0)
        ELSE COALESCE(cost_price, 0) * COALESCE(stock_quantity, 0)
      END
    ), 0)::numeric AS total_value
  FROM parts;
$$;

GRANT EXECUTE ON FUNCTION get_inventory_catalog_stats() TO authenticated;

COMMIT;

-- Sanity verification
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_customers_name_trgm', 'idx_customers_phone_trgm', 'idx_customers_account_trgm',
    'idx_customers_email_trgm', 'idx_customers_address_trgm',
    'idx_parts_name_trgm', 'idx_parts_code_trgm',
    'idx_parts_low_stock', 'idx_parts_out_of_stock'
  )
ORDER BY indexname;
