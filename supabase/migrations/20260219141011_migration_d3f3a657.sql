-- Create me_contractors table
CREATE TABLE me_contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region TEXT,
  postcode TEXT,
  address TEXT,
  sic_code TEXT,
  employees INTEGER,
  turnover_gbp DECIMAL(15,2),
  status TEXT CHECK (status IN ('active', 'prospect', 'do_not_use', 'archived')) DEFAULT 'prospect',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE me_contractors ENABLE ROW LEVEL SECURITY;

-- Create policies (allow authenticated users full access)
CREATE POLICY "Users can view contractors" ON me_contractors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert contractors" ON me_contractors FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update contractors" ON me_contractors FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete contractors" ON me_contractors FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_me_contractors_updated_at
BEFORE UPDATE ON me_contractors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();