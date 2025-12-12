-- Create contact_timeline table for feed posts
CREATE TABLE IF NOT EXISTS contact_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN ('event', 'post', 'note')),
  content TEXT NOT NULL,
  event_id UUID REFERENCES contact_events(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contact_timeline ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view timeline entries" ON contact_timeline FOR SELECT USING (true);
CREATE POLICY "Users can insert timeline entries" ON contact_timeline FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own timeline entries" ON contact_timeline FOR UPDATE USING (auth.uid() = created_by_user_id);
CREATE POLICY "Users can delete their own timeline entries" ON contact_timeline FOR DELETE USING (auth.uid() = created_by_user_id);

-- Create index for faster queries
CREATE INDEX idx_contact_timeline_contact_id ON contact_timeline(contact_id);
CREATE INDEX idx_contact_timeline_created_at ON contact_timeline(created_at DESC);