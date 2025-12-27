CREATE TRIGGER set_opportunity_probability
  BEFORE INSERT OR UPDATE OF stage
  ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_probability();