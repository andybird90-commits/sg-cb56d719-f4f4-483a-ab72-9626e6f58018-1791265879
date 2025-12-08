-- Step 4: Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('secured', 'high_potential', 'bid')),
  status TEXT DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'closed_won', 'closed_lost')),
  tender_due_date DATE,
  expected_start_date DATE,
  expected_end_date DATE,
  expected_fee_value NUMERIC,
  probability_percent INTEGER CHECK (probability_percent >= 0 AND probability_percent <= 100),
  linked_project_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id ON opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_linked_project_id ON opportunities(linked_project_id);