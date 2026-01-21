-- Drop the existing function first
DROP FUNCTION IF EXISTS generate_project_reference() CASCADE;

-- Recreate the function to generate sequential P-numbers (e.g., P26-001)
CREATE OR REPLACE FUNCTION generate_project_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
  new_ref TEXT;
BEGIN
  -- Get current year last 2 digits (e.g., '26')
  year_prefix := to_char(CURRENT_DATE, 'YY');
  
  -- If manually provided, keep it
  IF NEW.project_reference IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find the next sequence number for this year
  -- Pattern: P{YY}-%
  SELECT 
    COALESCE(
      MAX(
        CAST(
          NULLIF(regexp_replace(project_reference, '^P\d{2}-', ''), '') AS INTEGER
        )
      ), 
      0
    ) + 1
  INTO next_num
  FROM projects
  WHERE project_reference LIKE 'P' || year_prefix || '-%';

  -- Format: P26-001
  new_ref := 'P' || year_prefix || '-' || lpad(next_num::text, 3, '0');
  
  NEW.project_reference := new_ref;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS set_project_reference ON projects;

CREATE TRIGGER set_project_reference
BEFORE INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION generate_project_reference();