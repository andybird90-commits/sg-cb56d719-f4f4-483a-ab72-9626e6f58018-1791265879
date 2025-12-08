-- Step 1: Create profiles table (if not exists) and ensure it has all required columns
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('admin', 'director', 'user')),
  default_hourly_cost_rate NUMERIC,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add any missing columns to existing profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'default_hourly_cost_rate') THEN
    ALTER TABLE profiles ADD COLUMN default_hourly_cost_rate NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
    ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
  END IF;
END $$;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);