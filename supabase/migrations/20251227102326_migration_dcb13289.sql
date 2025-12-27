-- Drop the trigger if it exists and create it
DROP TRIGGER IF EXISTS trigger_set_opportunity_reference ON opportunities;

CREATE TRIGGER trigger_set_opportunity_reference
  BEFORE INSERT ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION set_opportunity_reference();