-- Step 8: Create timesheets table
CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES project_activities(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES variations(id) ON DELETE SET NULL,
  hours NUMERIC NOT NULL CHECK (hours > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_timesheets_user_id ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_project_id ON timesheets(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(date);
CREATE INDEX IF NOT EXISTS idx_timesheets_user_date ON timesheets(user_id, date);