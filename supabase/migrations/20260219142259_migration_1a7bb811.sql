-- Create me_contractors_import_raw table
CREATE TABLE IF NOT EXISTS me_contractors_import_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  company_number TEXT,
  sic_code TEXT,
  status TEXT,
  postcode TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  town_city TEXT,
  region TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  employees INTEGER,
  turnover_gbp NUMERIC,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE me_contractors_import_raw ENABLE ROW LEVEL SECURITY;

-- Allow admins/directors to manage imports
CREATE POLICY "Admins can manage import data" ON me_contractors_import_raw
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'director')
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_import_raw_company_number ON me_contractors_import_raw(company_number);
CREATE INDEX IF NOT EXISTS idx_import_raw_processed ON me_contractors_import_raw(processed);