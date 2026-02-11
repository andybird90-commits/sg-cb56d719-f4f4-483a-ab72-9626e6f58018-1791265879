-- Create invoice_items table (without organisation_id)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_month_id UUID NOT NULL REFERENCES invoice_months(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id),
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  invoice_value NUMERIC(12,2),
  description TEXT,
  invoice_reference TEXT,
  excluded_this_month BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and directors can insert invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "All authenticated users can view invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX idx_invoice_items_invoice_month_id ON invoice_items(invoice_month_id);
CREATE INDEX idx_invoice_items_project_id ON invoice_items(project_id);