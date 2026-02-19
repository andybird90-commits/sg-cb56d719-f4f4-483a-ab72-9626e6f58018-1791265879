-- Add added_by_user_id column to projects table to track project owner
ALTER TABLE projects
ADD COLUMN added_by_user_id uuid REFERENCES profiles(id);

-- Add index for faster lookups
CREATE INDEX idx_projects_added_by_user_id ON projects(added_by_user_id);

-- Add comment
COMMENT ON COLUMN projects.added_by_user_id IS 'User who created/owns this project';