-- Add company_id, project_id, and po_reference columns to invoice_history
ALTER TABLE invoice_history
ADD COLUMN company_id UUID REFERENCES companies(id),
ADD COLUMN project_id UUID REFERENCES projects(id),
ADD COLUMN po_reference TEXT;

-- Add foreign key comments
COMMENT ON COLUMN invoice_history.company_id IS 'Reference to companies table';
COMMENT ON COLUMN invoice_history.project_id IS 'Reference to projects table';
COMMENT ON COLUMN invoice_history.po_reference IS 'Purchase order reference number';

-- Make client_name and project_name nullable since we now have proper foreign keys
ALTER TABLE invoice_history
ALTER COLUMN client_name DROP NOT NULL,
ALTER COLUMN project_name DROP NOT NULL;