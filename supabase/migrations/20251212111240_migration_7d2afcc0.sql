-- Create opportunity_timeline table (similar to contact_timeline)
CREATE TABLE IF NOT EXISTS opportunity_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN ('event', 'post', 'note', 'status_change')),
  content TEXT NOT NULL,
  event_id UUID REFERENCES opportunity_events(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE opportunity_timeline ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view opportunity timeline" ON opportunity_timeline FOR SELECT USING (true);
CREATE POLICY "Users can insert opportunity timeline" ON opportunity_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update opportunity timeline" ON opportunity_timeline FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "Users can delete opportunity timeline" ON opportunity_timeline FOR DELETE USING (created_by_user_id = auth.uid());

-- Create indexes for faster queries
CREATE INDEX idx_opportunity_timeline_opportunity_id ON opportunity_timeline(opportunity_id);
CREATE INDEX idx_opportunity_timeline_created_at ON opportunity_timeline(created_at DESC);
CREATE INDEX idx_opportunity_timeline_event_id ON opportunity_timeline(event_id);