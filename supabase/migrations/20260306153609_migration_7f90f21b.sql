-- Create temporary intake table for Bid Builder, if it does not already exist
CREATE TABLE IF NOT EXISTS public.opportunity_bid_intake_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NULL,
  session_id text NOT NULL,
  file_name text NOT NULL,
  file_type text NULL,
  file_size bigint NULL,
  file_path text NOT NULL,
  upload_status text NOT NULL DEFAULT 'temporary_uploaded',
  parsed_summary_json jsonb NULL,
  uploaded_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  purged_at timestamptz NULL,
  purge_reason text NULL
);

-- Enable row level security
ALTER TABLE public.opportunity_bid_intake_files ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies so we can re-create them idempotently
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_bid_intake_files'
      AND policyname = 'Users can view their own intake files'
  ) THEN
    DROP POLICY "Users can view their own intake files" ON public.opportunity_bid_intake_files;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_bid_intake_files'
      AND policyname = 'Users can insert their own intake files'
  ) THEN
    DROP POLICY "Users can insert their own intake files" ON public.opportunity_bid_intake_files;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_bid_intake_files'
      AND policyname = 'Users can update their own intake files'
  ) THEN
    DROP POLICY "Users can update their own intake files" ON public.opportunity_bid_intake_files;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_bid_intake_files'
      AND policyname = 'Users can delete their own intake files'
  ) THEN
    DROP POLICY "Users can delete their own intake files" ON public.opportunity_bid_intake_files;
  END IF;
END
$$;

-- Recreate standard per-user CRUD policies using auth.uid()
CREATE POLICY "Users can view their own intake files"
  ON public.opportunity_bid_intake_files
  FOR SELECT
  TO authenticated
  USING (uploaded_by_user_id = auth.uid());

CREATE POLICY "Users can insert their own intake files"
  ON public.opportunity_bid_intake_files
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by_user_id = auth.uid());

CREATE POLICY "Users can update their own intake files"
  ON public.opportunity_bid_intake_files
  FOR UPDATE
  TO authenticated
  USING (uploaded_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own intake files"
  ON public.opportunity_bid_intake_files
  FOR DELETE
  TO authenticated
  USING (uploaded_by_user_id = auth.uid());