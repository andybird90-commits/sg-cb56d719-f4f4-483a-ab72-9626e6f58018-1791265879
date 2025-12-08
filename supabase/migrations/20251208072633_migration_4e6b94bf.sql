-- Subcontractor costs policies
DROP POLICY IF EXISTS "All authenticated users can view subcontractor costs" ON subcontractor_costs;
DROP POLICY IF EXISTS "Admins and directors can insert subcontractor costs" ON subcontractor_costs;
DROP POLICY IF EXISTS "Admins and directors can update subcontractor costs" ON subcontractor_costs;
DROP POLICY IF EXISTS "Admins and directors can delete subcontractor costs" ON subcontractor_costs;

CREATE POLICY "All authenticated users can view subcontractor costs"
  ON subcontractor_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert subcontractor costs"
  ON subcontractor_costs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update subcontractor costs"
  ON subcontractor_costs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete subcontractor costs"
  ON subcontractor_costs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );