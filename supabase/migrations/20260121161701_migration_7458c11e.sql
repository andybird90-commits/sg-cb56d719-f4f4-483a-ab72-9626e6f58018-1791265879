-- Ensure projects table has the reference columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_reference TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS opportunity_reference TEXT;

-- Check column names for opportunities to fix the query
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'opportunities' 
AND table_schema = 'public'
ORDER BY ordinal_position;