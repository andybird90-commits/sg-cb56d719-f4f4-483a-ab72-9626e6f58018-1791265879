-- Add payment_terms column to companies table with default of 30 days
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS payment_terms INTEGER DEFAULT 30 CHECK (payment_terms IN (14, 30, 45, 60));

COMMENT ON COLUMN companies.payment_terms IS 'Payment terms in days (14, 30, 45, or 60)';