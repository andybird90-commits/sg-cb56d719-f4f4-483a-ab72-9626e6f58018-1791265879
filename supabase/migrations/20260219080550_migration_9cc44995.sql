-- Add new columns to invoice_items table for additional project/client details
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS accounts_email TEXT,
ADD COLUMN IF NOT EXISTS client_address TEXT,
ADD COLUMN IF NOT EXISTS enquiry_number TEXT,
ADD COLUMN IF NOT EXISTS project_reference TEXT,
ADD COLUMN IF NOT EXISTS project_owner_name TEXT,
ADD COLUMN IF NOT EXISTS payment_terms INTEGER;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_project_reference ON invoice_items(project_reference);
CREATE INDEX IF NOT EXISTS idx_invoice_items_enquiry_number ON invoice_items(enquiry_number);