-- Create invoice_history table for manual invoice entry
CREATE TABLE invoice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  project_name TEXT,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  net_amount NUMERIC NOT NULL CHECK (net_amount >= 0),
  vat_amount NUMERIC DEFAULT 0 CHECK (vat_amount >= 0),
  gross_amount NUMERIC GENERATED ALWAYS AS (net_amount + vat_amount) STORED,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'part_paid', 'paid', 'written_off')),
  paid_amount NUMERIC DEFAULT 0 CHECK (paid_amount >= 0),
  notes TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT due_date_after_invoice_date CHECK (due_date >= invoice_date)
);

-- Enable RLS
ALTER TABLE invoice_history ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view invoice history"
  ON invoice_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoice history"
  ON invoice_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice history"
  ON invoice_history FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete invoice history"
  ON invoice_history FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_invoice_history_status ON invoice_history(status);
CREATE INDEX idx_invoice_history_created_at ON invoice_history(created_at DESC);
CREATE INDEX idx_invoice_history_due_date ON invoice_history(due_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoice_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_history_updated_at
  BEFORE UPDATE ON invoice_history
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_history_updated_at();

COMMENT ON TABLE invoice_history IS 'Manual entry of historical/outstanding invoices - separate from generated invoices';
COMMENT ON COLUMN invoice_history.gross_amount IS 'Automatically calculated as net_amount + vat_amount';
COMMENT ON COLUMN invoice_history.status IS 'Invoice payment status: unpaid, part_paid, paid, written_off';