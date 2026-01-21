-- Create a function to generate the next project reference number
CREATE OR REPLACE FUNCTION generate_project_reference()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INTEGER;
  new_reference TEXT;
BEGIN
  -- Get current year (last 2 digits)
  current_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Find the highest existing project number for this year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(project_reference FROM 'P' || current_year || '-(\d+)') 
        AS INTEGER
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM projects
  WHERE project_reference LIKE 'P' || current_year || '-%';
  
  -- Format as P26-001, P26-002, etc.
  new_reference := 'P' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_reference;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to auto-assign project reference on insert
CREATE OR REPLACE FUNCTION set_project_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if project_reference is not already provided
  IF NEW.project_reference IS NULL THEN
    NEW.project_reference := generate_project_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists (to avoid errors on re-run)
DROP TRIGGER IF EXISTS trigger_set_project_reference ON projects;

-- Create trigger that fires before insert on projects table
CREATE TRIGGER trigger_set_project_reference
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_project_reference();

-- Add comment for documentation
COMMENT ON FUNCTION generate_project_reference() IS 'Generates sequential project reference numbers in format P26-001, P26-002, etc. based on current year';