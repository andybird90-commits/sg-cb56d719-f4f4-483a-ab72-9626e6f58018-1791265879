-- Create me_contractor_capabilities table
CREATE TABLE me_contractor_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES me_contractors(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  experience_years INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE me_contractor_capabilities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view capabilities" ON me_contractor_capabilities FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert capabilities" ON me_contractor_capabilities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update capabilities" ON me_contractor_capabilities FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete capabilities" ON me_contractor_capabilities FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_contractor_capabilities_contractor_id ON me_contractor_capabilities(contractor_id);