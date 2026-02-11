-- Make code column optional (nullable) since it's auto-generated
ALTER TABLE variations ALTER COLUMN code DROP NOT NULL;