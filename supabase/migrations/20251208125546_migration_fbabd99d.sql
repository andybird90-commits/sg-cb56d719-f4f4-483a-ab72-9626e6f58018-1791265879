-- Extend project_monthly_phasing table with actual revenue and invoicing fields
ALTER TABLE project_monthly_phasing
  ADD COLUMN IF NOT EXISTS actual_revenue NUMERIC,
  ADD COLUMN IF NOT EXISTS invoice_status TEXT
    CHECK (invoice_status = ANY(ARRAY['none','to_invoice','invoiced','paid']))
    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS invoice_ref TEXT,
  ADD COLUMN IF NOT EXISTS invoice_date DATE;

-- Add comment for clarity
COMMENT ON COLUMN project_monthly_phasing.revenue_amount IS 'Forecast revenue for this month';
COMMENT ON COLUMN project_monthly_phasing.actual_revenue IS 'Actual revenue billed/recognised for this month';
COMMENT ON COLUMN project_monthly_phasing.invoice_status IS 'Invoicing status: none, to_invoice, invoiced, or paid';
COMMENT ON COLUMN project_monthly_phasing.invoice_ref IS 'Invoice reference number';
COMMENT ON COLUMN project_monthly_phasing.invoice_date IS 'Date invoice was issued';