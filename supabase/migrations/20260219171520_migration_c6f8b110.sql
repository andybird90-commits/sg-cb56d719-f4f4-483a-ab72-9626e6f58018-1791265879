-- Add company_number and companies_house_raw columns to me_contractors
ALTER TABLE me_contractors
ADD COLUMN IF NOT EXISTS company_number text,
ADD COLUMN IF NOT EXISTS companies_house_raw jsonb;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contractors_company_number ON me_contractors(company_number);