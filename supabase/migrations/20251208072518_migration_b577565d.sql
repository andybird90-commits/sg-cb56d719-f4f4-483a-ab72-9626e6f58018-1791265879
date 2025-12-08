-- Step 10: Create monthly_budgets table
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  budget_revenue NUMERIC NOT NULL,
  budget_cost NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(year, month)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_year_month ON monthly_budgets(year, month);