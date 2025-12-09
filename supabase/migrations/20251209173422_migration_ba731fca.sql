-- Create contact_events table for tracking visits and functions
CREATE TABLE IF NOT EXISTS contact_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('visit', 'function')),
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE contact_events ENABLE ROW LEVEL SECURITY;

-- Create policies for contact_events
CREATE POLICY "Users can view contact events" ON contact_events FOR SELECT USING (true);
CREATE POLICY "Users can insert contact events" ON contact_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update contact events" ON contact_events FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete contact events" ON contact_events FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_contact_events_contact_id ON contact_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_events_date ON contact_events(event_date);