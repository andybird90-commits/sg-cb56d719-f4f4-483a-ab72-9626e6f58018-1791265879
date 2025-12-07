# Conexa DT - Supabase Database Setup Guide

## 1. Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Save your project URL and anon key

## 2. Configure Environment Variables

Create `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Run SQL Migrations

Go to the SQL Editor in your Supabase dashboard and execute the following SQL:

### Step 1: Create Custom Types

```sql
-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'director', 'user');
CREATE TYPE company_status AS ENUM ('active', 'prospect', 'inactive');
```

### Step 2: Create Tables

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role DEFAULT 'user' NOT NULL,
  default_hourly_cost_rate NUMERIC,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  sector TEXT,
  status company_status DEFAULT 'active' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### Step 3: Create Indexes

```sql
-- Create indexes for better query performance
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
```

### Step 4: Enable Row Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
```

### Step 5: Create RLS Policies

```sql
-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view basic info of other profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Admins and directors can update profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Companies policies
CREATE POLICY "All authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

-- Contacts policies
CREATE POLICY "All authenticated users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and directors can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins and directors can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'director')
    )
  );
```

### Step 6: Create Updated At Trigger

```sql
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Step 7: Create Automatic Profile Creation Trigger

**CRITICAL**: This trigger automatically creates a profile when a user signs up.

```sql
-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

This trigger will:
- Automatically create a profile when a user signs up
- Extract the full_name from user metadata
- Set default role to 'user'
- Run with elevated privileges (SECURITY DEFINER) to bypass RLS

## 4. Configure Authentication

1. Go to Authentication > Settings in Supabase dashboard
2. Enable Email provider
3. Configure email templates (optional)
4. Set Site URL to your deployment URL (for production)

## 5. Create First Admin User

After setting up the database, create your first user through the signup page, then manually update their role to 'admin':

```sql
-- Update user role to admin (replace email with your email)
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## 6. Test the Setup

1. Start your Next.js development server: `npm run dev`
2. Navigate to `/auth/signup` and create an account
3. Check Supabase dashboard to verify:
   - User created in Authentication > Users
   - Profile created in Database > profiles table
4. Sign in and test the application

## Security Notes

- RLS policies ensure users can only perform actions based on their role
- All tables have RLS enabled by default
- Regular users can only view data
- Admins and directors can create, update, and delete data
- Users can view their own profile details

## Next Steps

- Add more tables as needed (opportunities, projects, etc.)
- Customize RLS policies based on business requirements
- Set up database backups in Supabase dashboard
- Configure email templates for auth flows