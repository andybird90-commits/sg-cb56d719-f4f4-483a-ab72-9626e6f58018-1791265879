DO $$
BEGIN
  -- Ensure the intake table exists before touching policies
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'opportunity_bid_intake_files'
  ) THEN
    RAISE NOTICE 'Table opportunity_bid_intake_files does not exist; skipping policy creation.';
    RETURN;
  END IF;

  -- INSERT policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_bid_intake_files'
      AND policyname = 'Users can insert their own bid intake files'
  ) THEN
    DROP POLICY "Users can insert their own bid intake files"
    ON public.opportunity_bid_intake_files;
  END IF;

  CREATE POLICY "Users can insert their own bid intake files"
  ON public.opportunity_bid_intake_files
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by_user_id = auth.uid());

  -- SELECT policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_bid_intake_files'
      AND policyname = 'Users can view their own bid intake files'
  ) THEN
    DROP POLICY "Users can view their own bid intake files"
    ON public.opportunity_bid_intake_files;
  END IF;

  CREATE POLICY "Users can view their own bid intake files"
  ON public.opportunity_bid_intake_files
  FOR SELECT
  TO authenticated
  USING (uploaded_by_user_id = auth.uid());

  -- UPDATE policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_bid_intake_files'
      AND policyname = 'Users can update their own bid intake files'
  ) THEN
    DROP POLICY "Users can update their own bid intake files"
    ON public.opportunity_bid_intake_files;
  END IF;

  CREATE POLICY "Users can update their own bid intake files"
  ON public.opportunity_bid_intake_files
  FOR UPDATE
  TO authenticated
  USING (uploaded_by_user_id = auth.uid())
  WITH CHECK (uploaded_by_user_id = auth.uid());

  -- DELETE policy
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_bid_intake_files'
      AND policyname = 'Users can delete their own bid intake files'
  ) THEN
    DROP POLICY "Users can delete their own bid intake files"
    ON public.opportunity_bid_intake_files;
  END IF;

  CREATE POLICY "Users can delete their own bid intake files"
  ON public.opportunity_bid_intake_files
  FOR DELETE
  TO authenticated
  USING (uploaded_by_user_id = auth.uid());
END
$$;