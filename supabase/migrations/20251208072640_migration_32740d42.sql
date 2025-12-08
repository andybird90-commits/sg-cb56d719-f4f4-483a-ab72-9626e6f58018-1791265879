-- Timesheets policies (users can manage their own, admins see all)
DROP POLICY IF EXISTS "Users can view their own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Admins and directors can view all timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can insert their own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can update their own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can delete their own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Admins and directors can manage all timesheets" ON timesheets;

CREATE POLICY "Users can view their own timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and directors can view all timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can insert their own timesheets"
  ON timesheets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own timesheets"
  ON timesheets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own timesheets"
  ON timesheets FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and directors can manage all timesheets"
  ON timesheets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );