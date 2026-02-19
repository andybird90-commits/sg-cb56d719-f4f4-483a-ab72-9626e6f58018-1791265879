-- Create me_contractor_relationships table
CREATE TABLE me_contractor_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES me_contractors(id) ON DELETE CASCADE,
  interaction_type TEXT CHECK (interaction_type IN ('meeting', 'call', 'email', 'site_visit', 'tender', 'project')) NOT NULL,
  interaction_date DATE NOT NULL,
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE me_contractor_relationships ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view relationships" ON me_contractor_relationships FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert relationships" ON me_contractor_relationships FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update relationships" ON me_contractor_relationships FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete relationships" ON me_contractor_relationships FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX idx_contractor_relationships_contractor_id ON me_contractor_relationships(contractor_id);
CREATE INDEX idx_contractor_relationships_date ON me_contractor_relationships(interaction_date DESC);