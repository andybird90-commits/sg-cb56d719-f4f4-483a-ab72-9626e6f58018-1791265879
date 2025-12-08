-- Step 2: Update profiles table with new columns
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user' NOT NULL,
  ADD COLUMN IF NOT EXISTS default_hourly_cost_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Update email to NOT NULL if needed (safely)
ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN full_name SET NOT NULL;

-- Add unique constraint on email
ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);