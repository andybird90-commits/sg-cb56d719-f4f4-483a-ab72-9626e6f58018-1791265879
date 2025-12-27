-- Add new fields to opportunities table
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS tender_received_date date,
ADD COLUMN IF NOT EXISTS submitted_date date,
ADD COLUMN IF NOT EXISTS project_reference text;

-- Update probability_percent based on stage
UPDATE opportunities
SET probability_percent = CASE
  WHEN stage = 'lead' THEN 10
  WHEN stage = 'bid' THEN 25
  WHEN stage = 'high_potential' THEN 50
  WHEN stage = 'secured' THEN 100
  WHEN stage = 'lost' THEN 0
  ELSE probability_percent
END;

-- Add constraint to ensure probability matches stage
ALTER TABLE opportunities
DROP CONSTRAINT IF EXISTS opportunities_probability_stage_check;

ALTER TABLE opportunities
ADD CONSTRAINT opportunities_probability_stage_check CHECK (
  (stage = 'lead' AND probability_percent = 10) OR
  (stage = 'bid' AND probability_percent = 25) OR
  (stage = 'high_potential' AND probability_percent = 50) OR
  (stage = 'secured' AND probability_percent = 100) OR
  (stage = 'lost' AND probability_percent = 0)
);