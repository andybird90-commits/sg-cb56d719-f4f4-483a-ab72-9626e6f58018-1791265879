-- Step 6: Create project_activities table
CREATE TABLE IF NOT EXISTS project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  activity_type TEXT,
  billable BOOLEAN DEFAULT true NOT NULL,
  status TEXT DEFAULT 'not_started' NOT NULL CHECK (status IN ('not_started', 'in_progress', 'complete')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_status ON project_activities(status);