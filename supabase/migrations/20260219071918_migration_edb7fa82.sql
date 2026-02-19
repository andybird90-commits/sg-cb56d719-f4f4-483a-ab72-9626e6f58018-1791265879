-- Add landline and linkedin_url columns to contacts table
ALTER TABLE contacts 
ADD COLUMN landline TEXT,
ADD COLUMN linkedin_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN contacts.landline IS 'Contact landline/office phone number';
COMMENT ON COLUMN contacts.linkedin_url IS 'Contact LinkedIn profile URL';