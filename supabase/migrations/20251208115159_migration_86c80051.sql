-- Create project_monthly_phasing table
CREATE TABLE project_monthly_phasing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  revenue_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, year, month)
);

-- Create index for better query performance
CREATE INDEX idx_project_monthly_phasing_project_id ON project_monthly_phasing(project_id);
CREATE INDEX idx_project_monthly_phasing_year_month ON project_monthly_phasing(year, month);

-- Enable RLS
ALTER TABLE project_monthly_phasing ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "All authenticated users can view phasing"
  ON project_monthly_phasing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert phasing"
  ON project_monthly_phasing FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update phasing"
  ON project_monthly_phasing FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete phasing"
  ON project_monthly_phasing FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_project_monthly_phasing_updated_at
  BEFORE UPDATE ON project_monthly_phasing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();