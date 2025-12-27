-- Add archived column to opportunities table
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add archived_at and archived_by columns for audit trail
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by_user_id UUID REFERENCES profiles(id);

-- Create index for faster archive queries
CREATE INDEX IF NOT EXISTS idx_opportunities_archived ON opportunities(archived);