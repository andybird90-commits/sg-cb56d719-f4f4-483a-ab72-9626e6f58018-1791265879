-- Add accounts_email column to companies table
ALTER TABLE companies 
ADD COLUMN accounts_email text;

COMMENT ON COLUMN companies.accounts_email IS 'Email address for accounts/invoicing purposes';

-- Create index for faster lookups
CREATE INDEX idx_companies_accounts_email ON companies(accounts_email);