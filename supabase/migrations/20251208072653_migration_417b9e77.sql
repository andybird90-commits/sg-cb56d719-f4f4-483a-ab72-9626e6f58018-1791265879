-- Absences policies (users manage their own, admins approve)
DROP POLICY IF EXISTS "Users can view their own absences" ON absences;
DROP POLICY IF EXISTS "Admins and directors can view all absences" ON absences;
DROP POLICY IF EXISTS "Users can create their own absences" ON absences;
DROP POLICY IF EXISTS "Users can update their own pending absences" ON absences;
DROP POLICY IF EXISTS "Admins and directors can update any absence" ON absences;
DROP POLICY IF EXISTS "Users can delete their own pending absences" ON absences;
DROP POLICY IF EXISTS "Admins and directors can delete any absence" ON absences;

CREATE POLICY "Users can view their own absences"
  ON absences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and directors can view all absences"
  ON absences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can create their own absences"
  ON absences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pending absences"
  ON absences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND approved_by IS NULL);

CREATE POLICY "Admins and directors can update any absence"
  ON absences FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can delete their own pending absences"
  ON absences FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND approved_by IS NULL);

CREATE POLICY "Admins and directors can delete any absence"
  ON absences FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );