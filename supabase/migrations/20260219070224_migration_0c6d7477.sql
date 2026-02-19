-- Add company_number column to companies table
ALTER TABLE companies 
ADD COLUMN company_number text NULL;

-- Add an index for better query performance
CREATE INDEX idx_companies_company_number ON companies(company_number);

-- Add a comment to document the field
COMMENT ON COLUMN companies.company_number IS 'Registered company number for the organization';