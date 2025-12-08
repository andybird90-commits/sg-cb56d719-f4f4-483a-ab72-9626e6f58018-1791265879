-- Variations policies
DROP POLICY IF EXISTS "All authenticated users can view variations" ON variations;
DROP POLICY IF EXISTS "Admins and directors can insert variations" ON variations;
DROP POLICY IF EXISTS "Admins and directors can update variations" ON variations;
DROP POLICY IF EXISTS "Admins and directors can delete variations" ON variations;

CREATE POLICY "All authenticated users can view variations"
  ON variations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert variations"
  ON variations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update variations"
  ON variations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete variations"
  ON variations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );