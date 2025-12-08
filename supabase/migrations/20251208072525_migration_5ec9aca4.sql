-- Step 11: Create absences table
CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('holiday', 'sick', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (end_date >= start_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_absences_user_id ON absences(user_id);
CREATE INDEX IF NOT EXISTS idx_absences_date_range ON absences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absences_approved_by ON absences(approved_by);