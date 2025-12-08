-- Step 7: Create variations table
CREATE TABLE IF NOT EXISTS variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  value NUMERIC NOT NULL,
  status TEXT DEFAULT 'proposed' NOT NULL CHECK (status IN ('proposed', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_variations_project_id ON variations(project_id);
CREATE INDEX IF NOT EXISTS idx_variations_status ON variations(status);