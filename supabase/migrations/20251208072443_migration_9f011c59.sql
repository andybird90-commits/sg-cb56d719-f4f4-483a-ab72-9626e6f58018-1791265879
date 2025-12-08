-- Step 5: Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  client_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'pipeline' NOT NULL CHECK (status IN ('pipeline', 'live', 'on_hold', 'completed', 'cancelled')),
  agreed_fee_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add foreign key constraint for opportunities.linked_project_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'opportunities_linked_project_id_fkey'
  ) THEN
    ALTER TABLE opportunities
    ADD CONSTRAINT opportunities_linked_project_id_fkey
    FOREIGN KEY (linked_project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_opportunity_id ON projects(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_company_id ON projects(client_company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);