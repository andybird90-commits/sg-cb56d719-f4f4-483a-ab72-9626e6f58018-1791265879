-- Add new fields to companies table
ALTER TABLE companies 
ADD COLUMN address TEXT,
ADD COLUMN vat_number TEXT,
ADD COLUMN website TEXT,
ADD COLUMN linkedin_url TEXT;

-- Add helpful comments
COMMENT ON COLUMN companies.address IS 'Physical address of the company';
COMMENT ON COLUMN companies.vat_number IS 'VAT/Tax registration number';
COMMENT ON COLUMN companies.website IS 'Company website URL';
COMMENT ON COLUMN companies.linkedin_url IS 'Company LinkedIn profile URL';