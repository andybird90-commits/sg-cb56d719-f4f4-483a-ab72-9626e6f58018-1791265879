-- Create opportunity_events table (similar to contact_events)
CREATE TABLE IF NOT EXISTS opportunity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('meeting', 'pitch', 'follow-up', 'demo')),
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE opportunity_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view opportunity events" ON opportunity_events FOR SELECT USING (true);
CREATE POLICY "Users can insert opportunity events" ON opportunity_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update opportunity events" ON opportunity_events FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete opportunity events" ON opportunity_events FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX idx_opportunity_events_opportunity_id ON opportunity_events(opportunity_id);
CREATE INDEX idx_opportunity_events_event_date ON opportunity_events(event_date);