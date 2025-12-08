-- Project activities policies
DROP POLICY IF EXISTS "All authenticated users can view project activities" ON project_activities;
DROP POLICY IF EXISTS "Admins and directors can insert project activities" ON project_activities;
DROP POLICY IF EXISTS "Admins and directors can update project activities" ON project_activities;
DROP POLICY IF EXISTS "Admins and directors can delete project activities" ON project_activities;

CREATE POLICY "All authenticated users can view project activities"
  ON project_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert project activities"
  ON project_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update project activities"
  ON project_activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete project activities"
  ON project_activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );