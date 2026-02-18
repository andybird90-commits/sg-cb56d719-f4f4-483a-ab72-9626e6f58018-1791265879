-- Add created_by_user_id column to variations table
ALTER TABLE variations 
ADD COLUMN created_by_user_id UUID REFERENCES profiles(id);

-- Set existing variations to a default user (optional - or leave as NULL)
-- UPDATE variations SET created_by_user_id = (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1) WHERE created_by_user_id IS NULL;