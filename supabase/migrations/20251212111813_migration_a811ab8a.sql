-- Update the event_type enum to include 'call'
ALTER TABLE opportunity_events 
DROP CONSTRAINT IF EXISTS opportunity_events_event_type_check;

ALTER TABLE opportunity_events 
ADD CONSTRAINT opportunity_events_event_type_check 
CHECK (event_type IN ('meeting', 'pitch', 'follow_up', 'demo', 'call'));