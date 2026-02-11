-- Drop the existing foreign key constraint
ALTER TABLE invoice_items
DROP CONSTRAINT IF EXISTS invoice_items_project_id_fkey;

-- Add the constraint back with ON DELETE CASCADE
ALTER TABLE invoice_items
ADD CONSTRAINT invoice_items_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;