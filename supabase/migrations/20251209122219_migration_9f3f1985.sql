-- Add added_by_user_id to contacts table
ALTER TABLE contacts 
ADD COLUMN added_by_user_id UUID REFERENCES profiles(id);

-- Add added_by_user_id to opportunities table
ALTER TABLE opportunities 
ADD COLUMN added_by_user_id UUID REFERENCES profiles(id);

-- Add added_by_user_id to companies table
ALTER TABLE companies 
ADD COLUMN added_by_user_id UUID REFERENCES profiles(id);