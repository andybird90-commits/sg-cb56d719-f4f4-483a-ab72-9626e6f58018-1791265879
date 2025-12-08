-- Step 12: Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
    EXECUTE format('
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
    ', t, t);
  END LOOP;
END $$;