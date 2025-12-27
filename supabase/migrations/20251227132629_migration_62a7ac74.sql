-- Create opportunity_monthly_phasing table to match project_monthly_phasing structure
CREATE TABLE opportunity_monthly_phasing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  revenue_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(opportunity_id, year, month)
);

-- Create indexes for performance
CREATE INDEX idx_opportunity_monthly_phasing_opportunity_id ON opportunity_monthly_phasing(opportunity_id);
CREATE INDEX idx_opportunity_monthly_phasing_year_month ON opportunity_monthly_phasing(year, month);

-- Enable RLS
ALTER TABLE opportunity_monthly_phasing ENABLE ROW LEVEL SECURITY;

-- Create RLS policies matching project_monthly_phasing
CREATE POLICY "Admins and directors can insert phasing" ON opportunity_monthly_phasing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update phasing" ON opportunity_monthly_phasing
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete phasing" ON opportunity_monthly_phasing
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "All authenticated users can view phasing" ON opportunity_monthly_phasing
  FOR SELECT
  TO authenticated
  USING (true);