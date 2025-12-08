-- Step 9: Create subcontractor_costs table
CREATE TABLE IF NOT EXISTS subcontractor_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES variations(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  description TEXT,
  cost_amount NUMERIC NOT NULL,
  cost_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subcontractor_costs_project_id ON subcontractor_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_costs_variation_id ON subcontractor_costs(variation_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_costs_date ON subcontractor_costs(cost_date);