-- Monthly budgets policies
DROP POLICY IF EXISTS "All authenticated users can view budgets" ON monthly_budgets;
DROP POLICY IF EXISTS "Admins and directors can insert budgets" ON monthly_budgets;
DROP POLICY IF EXISTS "Admins and directors can update budgets" ON monthly_budgets;
DROP POLICY IF EXISTS "Admins and directors can delete budgets" ON monthly_budgets;

CREATE POLICY "All authenticated users can view budgets"
  ON monthly_budgets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert budgets"
  ON monthly_budgets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update budgets"
  ON monthly_budgets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete budgets"
  ON monthly_budgets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );