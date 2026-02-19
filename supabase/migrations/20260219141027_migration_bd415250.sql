-- Create me_contractor_contacts table
CREATE TABLE me_contractor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES me_contractors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE me_contractor_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view contacts" ON me_contractor_contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert contacts" ON me_contractor_contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update contacts" ON me_contractor_contacts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete contacts" ON me_contractor_contacts FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create index
CREATE INDEX idx_contractor_contacts_contractor_id ON me_contractor_contacts(contractor_id);

-- Create updated_at trigger
CREATE TRIGGER update_me_contractor_contacts_updated_at
BEFORE UPDATE ON me_contractor_contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();