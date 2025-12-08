-- Step 14: Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view other profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and directors can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and directors can insert profiles" ON profiles;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view other profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Admins and directors can update profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );