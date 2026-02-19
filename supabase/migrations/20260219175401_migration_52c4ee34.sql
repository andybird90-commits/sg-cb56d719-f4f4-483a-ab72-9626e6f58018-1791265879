-- Add enhancement_confidence and last_enhanced_at columns to me_contractors
ALTER TABLE me_contractors
ADD COLUMN IF NOT EXISTS enhancement_confidence numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_enhanced_at timestamp with time zone;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_contractors_enhancement ON me_contractors(enhancement_confidence, last_enhanced_at);

-- Add comment to explain the column
COMMENT ON COLUMN me_contractors.enhancement_confidence IS 'AI confidence score (0-100) for the quality of contractor data enhancement';
COMMENT ON COLUMN me_contractors.last_enhanced_at IS 'Timestamp when the contractor data was last enhanced via AI';