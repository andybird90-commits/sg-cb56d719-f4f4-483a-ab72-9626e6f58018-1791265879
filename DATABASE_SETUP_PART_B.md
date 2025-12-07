# Conexa DT - Database Setup Part B

## SQL Migrations for Part B Tables

Execute these SQL statements in your Supabase SQL Editor after completing Part A setup.

### Step 1: Create Enum Types

```sql
-- Create additional enum types for Part B
CREATE TYPE opportunity_stage AS ENUM ('secured', 'high_potential', 'bid');
CREATE TYPE opportunity_status AS ENUM ('open', 'closed_won', 'closed_lost');
CREATE TYPE project_status AS ENUM ('pipeline', 'live', 'on_hold', 'completed');
CREATE TYPE activity_status AS ENUM ('not_started', 'in_progress', 'complete');
CREATE TYPE variation_status AS ENUM ('proposed', 'accepted', 'rejected');
```

### Step 2: Create Tables

```sql
-- Create opportunities table
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  stage opportunity_stage DEFAULT 'bid' NOT NULL,
  status opportunity_status DEFAULT 'open' NOT NULL,
  tender_due_date DATE,
  expected_start_date DATE,
  expected_end_date DATE,
  expected_fee_value NUMERIC,
  probability_percent INTEGER CHECK (probability_percent >= 0 AND probability_percent <= 100),
  linked_project_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  client_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  status project_status DEFAULT 'pipeline' NOT NULL,
  agreed_fee_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add foreign key constraint for linked_project_id after projects table exists
ALTER TABLE opportunities
ADD CONSTRAINT opportunities_linked_project_id_fkey
FOREIGN KEY (linked_project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Create project_activities table
CREATE TABLE project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  activity_type TEXT,
  billable BOOLEAN DEFAULT true NOT NULL,
  status activity_status DEFAULT 'not_started' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create variations table
CREATE TABLE variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  value NUMERIC NOT NULL,
  status variation_status DEFAULT 'proposed' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create timesheets table
CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES project_activities(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES variations(id) ON DELETE SET NULL,
  hours NUMERIC NOT NULL CHECK (hours > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create subcontractor_costs table
CREATE TABLE subcontractor_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES variations(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  description TEXT,
  cost_amount NUMERIC NOT NULL,
  cost_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### Step 3: Create Indexes

```sql
-- Create indexes for better query performance
CREATE INDEX idx_opportunities_company_id ON opportunities(company_id);
CREATE INDEX idx_opportunities_contact_id ON opportunities(contact_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);
CREATE INDEX idx_opportunities_status ON opportunities(status);

CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_projects_opportunity_id ON projects(opportunity_id);
CREATE INDEX idx_projects_client_company_id ON projects(client_company_id);
CREATE INDEX idx_projects_status ON projects(status);

CREATE INDEX idx_project_activities_project_id ON project_activities(project_id);
CREATE INDEX idx_variations_project_id ON variations(project_id);

CREATE INDEX idx_timesheets_user_id ON timesheets(user_id);
CREATE INDEX idx_timesheets_project_id ON timesheets(project_id);
CREATE INDEX idx_timesheets_date ON timesheets(date);
CREATE INDEX idx_timesheets_user_date ON timesheets(user_id, date);

CREATE INDEX idx_subcontractor_costs_project_id ON subcontractor_costs(project_id);
CREATE INDEX idx_subcontractor_costs_variation_id ON subcontractor_costs(variation_id);
```

### Step 4: Enable Row Level Security

```sql
-- Enable RLS on all new tables
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_costs ENABLE ROW LEVEL SECURITY;
```

### Step 5: Create RLS Policies

```sql
-- Opportunities policies
CREATE POLICY "All authenticated users can view opportunities"
  ON opportunities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update opportunities"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete opportunities"
  ON opportunities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Projects policies (same pattern as opportunities)
CREATE POLICY "All authenticated users can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Project activities policies (same as projects)
CREATE POLICY "All authenticated users can view project activities"
  ON project_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert project activities"
  ON project_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update project activities"
  ON project_activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete project activities"
  ON project_activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Variations policies (same as projects)
CREATE POLICY "All authenticated users can view variations"
  ON variations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert variations"
  ON variations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update variations"
  ON variations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete variations"
  ON variations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Timesheets policies (users can manage their own, admins see all)
CREATE POLICY "Users can view their own timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and directors can view all timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can insert their own timesheets"
  ON timesheets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own timesheets"
  ON timesheets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own timesheets"
  ON timesheets FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and directors can manage all timesheets"
  ON timesheets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Subcontractor costs policies (same as projects)
CREATE POLICY "All authenticated users can view subcontractor costs"
  ON subcontractor_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert subcontractor costs"
  ON subcontractor_costs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update subcontractor costs"
  ON subcontractor_costs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete subcontractor costs"
  ON subcontractor_costs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );
```

### Step 6: Create Updated At Triggers

```sql
-- Create triggers for all new tables
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_activities_updated_at
  BEFORE UPDATE ON project_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variations_updated_at
  BEFORE UPDATE ON variations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcontractor_costs_updated_at
  BEFORE UPDATE ON subcontractor_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Summary

After running these migrations, you will have:

- ✅ **6 new tables**: opportunities, projects, project_activities, variations, timesheets, subcontractor_costs
- ✅ **5 new enum types**: opportunity_stage, opportunity_status, project_status, activity_status, variation_status
- ✅ **Proper foreign key relationships** between all tables
- ✅ **RLS policies** enforcing role-based access control
- ✅ **Indexes** for optimal query performance
- ✅ **Auto-updating timestamps** on all tables

The database is now ready for full project management, opportunities tracking, and timesheet functionality.