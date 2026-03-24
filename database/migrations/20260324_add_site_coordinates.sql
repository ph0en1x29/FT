-- Add latitude/longitude to customer_sites for map feature
ALTER TABLE customer_sites
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN customer_sites.latitude IS 'GPS latitude for map pin';
COMMENT ON COLUMN customer_sites.longitude IS 'GPS longitude for map pin';
