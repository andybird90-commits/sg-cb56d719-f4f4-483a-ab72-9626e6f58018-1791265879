-- Drop the existing foreign key constraint on contact_timeline.created_by_user_id
ALTER TABLE contact_timeline 
DROP CONSTRAINT IF EXISTS contact_timeline_created_by_user_id_fkey;

-- Add the correct foreign key constraint pointing to profiles.id
ALTER TABLE contact_timeline
ADD CONSTRAINT contact_timeline_created_by_user_id_fkey 
FOREIGN KEY (created_by_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Also fix contact_events.created_by to point to profiles.id for consistency
ALTER TABLE contact_events
DROP CONSTRAINT IF EXISTS contact_events_created_by_fkey;

ALTER TABLE contact_events
ADD CONSTRAINT contact_events_created_by_fkey
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;