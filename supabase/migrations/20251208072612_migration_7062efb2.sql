-- Projects policies
DROP POLICY IF EXISTS "All authenticated users can view projects" ON projects;
DROP POLICY IF EXISTS "Admins and directors can insert projects" ON projects;
DROP POLICY IF EXISTS "Admins and directors can update projects" ON projects;
DROP POLICY IF EXISTS "Admins and directors can delete projects" ON projects;

CREATE POLICY "All authenticated users can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );