ALTER TABLE opportunities
ADD CONSTRAINT opportunities_probability_check CHECK (
  CASE
    WHEN stage = 'lead' THEN probability_percent = 10
    WHEN stage = 'in_bid' OR stage = 'bid' THEN probability_percent = 25
    WHEN stage = 'high_potential' THEN probability_percent = 50
    WHEN stage = 'won' OR stage = 'secured' THEN probability_percent = 100
    WHEN stage = 'lost' THEN probability_percent = 0
    ELSE true
  END
);