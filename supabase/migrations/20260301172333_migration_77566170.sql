CREATE TABLE IF NOT EXISTS win_themes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strategy_settings jsonb NOT NULL,
  payload jsonb NOT NULL,
  summary text
);

ALTER TABLE win_themes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'win_themes'
      AND policyname = 'Users can view their own win themes'
  ) THEN
    CREATE POLICY "Users can view their own win themes"
      ON win_themes
      FOR SELECT
      USING (auth.uid() = generated_by_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'win_themes'
      AND policyname = 'Users can insert their own win themes'
  ) THEN
    CREATE POLICY "Users can insert their own win themes"
      ON win_themes
      FOR INSERT
      WITH CHECK (auth.uid() = generated_by_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'win_themes'
      AND policyname = 'Users can update their own win themes'
  ) THEN
    CREATE POLICY "Users can update their own win themes"
      ON win_themes
      FOR UPDATE
      USING (auth.uid() = generated_by_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'win_themes'
      AND policyname = 'Users can delete their own win themes'
  ) THEN
    CREATE POLICY "Users can delete their own win themes"
      ON win_themes
      FOR DELETE
      USING (auth.uid() = generated_by_user_id);
  END IF;
END
$$;