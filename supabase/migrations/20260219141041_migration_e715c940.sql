-- Create me_contractor_radar_scores table
CREATE TABLE me_contractor_radar_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES me_contractors(id) ON DELETE CASCADE UNIQUE,
  radar_score DECIMAL(5,2) DEFAULT 0 CHECK (radar_score >= 0 AND radar_score <= 100),
  fit_geo DECIMAL(5,2) DEFAULT 0,
  fit_size DECIMAL(5,2) DEFAULT 0,
  fit_specialism DECIMAL(5,2) DEFAULT 0,
  relationship_heat DECIMAL(5,2) DEFAULT 0,
  performance DECIMAL(5,2) DEFAULT 0,
  data_completeness DECIMAL(5,2) DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE me_contractor_radar_scores ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view radar scores" ON me_contractor_radar_scores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert radar scores" ON me_contractor_radar_scores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update radar scores" ON me_contractor_radar_scores FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete radar scores" ON me_contractor_radar_scores FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create unique index
CREATE UNIQUE INDEX idx_radar_scores_contractor_id ON me_contractor_radar_scores(contractor_id);