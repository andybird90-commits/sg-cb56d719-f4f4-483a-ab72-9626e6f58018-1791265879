-- Create invoice_months table
CREATE TABLE invoice_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status TEXT NOT NULL CHECK (status IN ('open', 'locked')) DEFAULT 'open',
  locked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  locked_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT invoice_months_year_month_unique UNIQUE (year, month)
);

-- Create indexes for invoice_months
CREATE INDEX idx_invoice_months_year_month ON invoice_months(year, month);
CREATE INDEX idx_invoice_months_status ON invoice_months(status);

-- Enable RLS on invoice_months
ALTER TABLE invoice_months ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_months
-- All authenticated users can view invoice months
CREATE POLICY "All authenticated users can view invoice months"
  ON invoice_months FOR SELECT
  TO authenticated
  USING (true);

-- Admins and directors can insert invoice months
CREATE POLICY "Admins and directors can insert invoice months"
  ON invoice_months FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );

-- Admins and directors can update invoice months
CREATE POLICY "Admins and directors can update invoice months"
  ON invoice_months FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );

-- Admins and directors can delete invoice months
CREATE POLICY "Admins and directors can delete invoice months"
  ON invoice_months FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );