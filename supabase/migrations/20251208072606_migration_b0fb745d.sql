-- Opportunities policies
DROP POLICY IF EXISTS "All authenticated users can view opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admins and directors can insert opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admins and directors can update opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admins and directors can delete opportunities" ON opportunities;

CREATE POLICY "All authenticated users can view opportunities"
  ON opportunities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update opportunities"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete opportunities"
  ON opportunities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );