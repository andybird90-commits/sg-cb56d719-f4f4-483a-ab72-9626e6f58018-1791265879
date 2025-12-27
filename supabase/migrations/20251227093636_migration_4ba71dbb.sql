-- Create a trigger function to automatically update probability when stage changes
CREATE OR REPLACE FUNCTION update_opportunity_probability()
RETURNS TRIGGER AS $$
BEGIN
  NEW.probability_percent := CASE 
    WHEN NEW.stage = 'lead' THEN 10
    WHEN NEW.stage = 'in_bid' THEN 25
    WHEN NEW.stage = 'high_potential' THEN 50
    WHEN NEW.stage = 'won' THEN 100
    WHEN NEW.stage = 'secured' THEN 100
    WHEN NEW.stage = 'lost' THEN 0
    ELSE NEW.probability_percent
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_opportunity_probability ON opportunities;

-- Create trigger that fires before insert or update
CREATE TRIGGER trigger_update_opportunity_probability
  BEFORE INSERT OR UPDATE OF stage
  ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_probability();