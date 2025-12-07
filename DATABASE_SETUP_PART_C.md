# Conexa DT - Database Setup Part C

## SQL Migrations for Part C Tables (Financials & Absences)

Execute these SQL statements in your Supabase SQL Editor after completing Part A and Part B setup.

### Step 1: Create Enum Types

```sql
-- Create enum type for absence types
CREATE TYPE absence_type AS ENUM ('holiday', 'sick', 'other');
```

### Step 2: Create Tables

```sql
-- Create monthly_budgets table
CREATE TABLE monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  budget_revenue NUMERIC NOT NULL,
  budget_cost NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(year, month)
);

-- Create absences table
CREATE TABLE absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type absence_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (end_date >= start_date)
);
```

### Step 3: Create Indexes

```sql
-- Create indexes for better query performance
CREATE INDEX idx_monthly_budgets_year_month ON monthly_budgets(year, month);
CREATE INDEX idx_absences_user_id ON absences(user_id);
CREATE INDEX idx_absences_date_range ON absences(start_date, end_date);
CREATE INDEX idx_absences_approved_by ON absences(approved_by);
```

### Step 4: Enable Row Level Security

```sql
-- Enable RLS on new tables
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
```

### Step 5: Create RLS Policies

```sql
-- Monthly budgets policies
CREATE POLICY "All authenticated users can view budgets"
  ON monthly_budgets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert budgets"
  ON monthly_budgets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update budgets"
  ON monthly_budgets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete budgets"
  ON monthly_budgets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Absences policies
CREATE POLICY "Users can view their own absences"
  ON absences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins and directors can view all absences"
  ON absences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can create their own absences"
  ON absences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pending absences"
  ON absences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND approved_by IS NULL);

CREATE POLICY "Admins and directors can update any absence"
  ON absences FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Users can delete their own pending absences"
  ON absences FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND approved_by IS NULL);

CREATE POLICY "Admins and directors can delete any absence"
  ON absences FOR DELETE
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
-- Create triggers for new tables
CREATE TRIGGER update_monthly_budgets_updated_at
  BEFORE UPDATE ON monthly_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_absences_updated_at
  BEFORE UPDATE ON absences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Summary

After running these migrations, you will have:

- ✅ **2 new tables**: monthly_budgets, absences
- ✅ **1 new enum type**: absence_type
- ✅ **Proper foreign key relationships** between absences and profiles
- ✅ **RLS policies** enforcing role-based access control
- ✅ **Indexes** for optimal query performance
- ✅ **Auto-updating timestamps** on all tables
- ✅ **User-level access control** for absences (users manage their own, admins see all)

The database is now ready for financial tracking, budget management, and absence/leave management.