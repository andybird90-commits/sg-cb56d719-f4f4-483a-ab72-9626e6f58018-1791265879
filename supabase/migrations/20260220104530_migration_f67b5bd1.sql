-- Create league table for curated contractor rankings
CREATE TABLE IF NOT EXISTS me_contractor_league_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contractor_id UUID NOT NULL REFERENCES me_contractors(id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL,
  fit_reason TEXT,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contractor_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_league_table_rank ON me_contractor_league_table(rank_position);
CREATE INDEX IF NOT EXISTS idx_league_table_contractor ON me_contractor_league_table(contractor_id);

-- Enable RLS
ALTER TABLE me_contractor_league_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view league table" ON me_contractor_league_table FOR SELECT USING (true);
CREATE POLICY "Users can insert league table entries" ON me_contractor_league_table FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update league table entries" ON me_contractor_league_table FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete league table entries" ON me_contractor_league_table FOR DELETE USING (auth.uid() IS NOT NULL);