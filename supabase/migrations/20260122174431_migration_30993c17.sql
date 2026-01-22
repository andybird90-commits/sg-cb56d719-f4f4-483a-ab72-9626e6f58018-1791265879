-- Make the code column nullable and remove the unique constraint
ALTER TABLE projects ALTER COLUMN code DROP NOT NULL;

-- Drop the unique constraint on code since we'll phase it out
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_code_key;

-- Drop the index on code
DROP INDEX IF EXISTS idx_projects_code;