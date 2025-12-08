-- Step 2: Create companies table (if not exists) and ensure schema
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  sector TEXT,
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'prospect', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add any missing columns
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'updated_at') THEN
    ALTER TABLE companies ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);