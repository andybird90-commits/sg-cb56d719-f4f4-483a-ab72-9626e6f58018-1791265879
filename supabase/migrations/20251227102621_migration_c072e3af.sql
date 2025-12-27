-- Update the trigger to only set reference if it's NULL or empty
DROP TRIGGER IF EXISTS trigger_set_opportunity_reference ON opportunities;

CREATE OR REPLACE FUNCTION set_opportunity_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-generate if project_reference is NULL or empty string
  IF NEW.project_reference IS NULL OR NEW.project_reference = '' THEN
    NEW.project_reference := generate_opportunity_reference();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_opportunity_reference
  BEFORE INSERT ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION set_opportunity_reference();