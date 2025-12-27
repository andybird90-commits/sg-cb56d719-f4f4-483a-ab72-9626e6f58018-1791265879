-- 2. NOW add the constraint
ALTER TABLE opportunities
DROP CONSTRAINT IF EXISTS opportunities_probability_check;

ALTER TABLE opportunities
ADD CONSTRAINT opportunities_probability_check CHECK (
  (stage = 'lead' AND probability_percent = 10) OR
  (stage = 'in_bid' AND probability_percent = 25) OR
  (stage = 'high_potential' AND probability_percent = 50) OR
  (stage = 'won' AND probability_percent = 100) OR
  (stage = 'secured' AND probability_percent = 100) OR
  (stage = 'lost' AND probability_percent = 0) OR
  (stage NOT IN ('lead', 'in_bid', 'high_potential', 'won', 'secured', 'lost')) -- Allow other stages if they exist, or strict?
);