-- Add enquiry_number column to opportunities table
ALTER TABLE opportunities 
ADD COLUMN enquiry_number TEXT;

COMMENT ON COLUMN opportunities.enquiry_number IS 'Unique enquiry reference number (letters and numbers)';

-- Create index for enquiry_number for faster searches
CREATE INDEX idx_opportunities_enquiry_number ON opportunities(enquiry_number);