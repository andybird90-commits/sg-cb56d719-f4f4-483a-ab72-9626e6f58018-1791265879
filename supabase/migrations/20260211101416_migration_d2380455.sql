-- Add ON DELETE CASCADE to project_activities
ALTER TABLE project_activities
DROP CONSTRAINT IF EXISTS project_activities_project_id_fkey,
ADD CONSTRAINT project_activities_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;

-- Add ON DELETE CASCADE to variations
ALTER TABLE variations
DROP CONSTRAINT IF EXISTS variations_project_id_fkey,
ADD CONSTRAINT variations_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;

-- Add ON DELETE CASCADE to subcontractor_costs
ALTER TABLE subcontractor_costs
DROP CONSTRAINT IF EXISTS subcontractor_costs_project_id_fkey,
ADD CONSTRAINT subcontractor_costs_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;

-- Add ON DELETE CASCADE to project_monthly_phasing
ALTER TABLE project_monthly_phasing
DROP CONSTRAINT IF EXISTS project_monthly_phasing_project_id_fkey,
ADD CONSTRAINT project_monthly_phasing_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;