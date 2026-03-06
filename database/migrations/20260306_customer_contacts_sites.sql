-- Customer Contacts (PICs) and Sites
-- Created: 2026-03-06

CREATE TABLE IF NOT EXISTS customer_contacts (
  contact_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT,                    -- e.g., "Site Manager", "Operations", "Accounts"
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_sites (
  site_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage customer_contacts"
  ON customer_contacts FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage customer_sites"
  ON customer_sites FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
