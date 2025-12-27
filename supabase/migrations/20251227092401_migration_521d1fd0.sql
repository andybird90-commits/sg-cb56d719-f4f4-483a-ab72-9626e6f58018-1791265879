-- Add archived column to projects table as well
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by_user_id UUID REFERENCES profiles(id);

-- Create index for faster archive queries
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);