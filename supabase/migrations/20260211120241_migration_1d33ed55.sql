-- Add PO number field to invoice_items table to store it for invoicing
ALTER TABLE invoice_items ADD COLUMN po_number text;