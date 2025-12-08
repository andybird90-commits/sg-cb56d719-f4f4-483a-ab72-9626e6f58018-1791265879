-- Step 15: Create RLS policies for companies, contacts, opportunities, projects, activities, variations, costs
-- All authenticated users can view, only admin/director can modify

-- Companies
DROP POLICY IF EXISTS "All authenticated users can view companies" ON companies;
DROP POLICY IF EXISTS "Admins and directors can insert companies" ON companies;
DROP POLICY IF EXISTS "Admins and directors can update companies" ON companies;
DROP POLICY IF EXISTS "Admins and directors can delete companies" ON companies;

CREATE POLICY "All authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );