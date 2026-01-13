-- Add archived_reason column to opportunities table
ALTER TABLE opportunities 
ADD COLUMN IF NOT EXISTS archived_reason text NULL;

-- Add archived_reason column to projects table  
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS archived_reason text NULL;

-- Create index on archived column for better query performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_opportunities_archived ON opportunities(archived);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);