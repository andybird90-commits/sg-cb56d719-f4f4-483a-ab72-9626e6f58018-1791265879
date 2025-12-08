-- Step 1: Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'director', 'user');
CREATE TYPE company_status AS ENUM ('active', 'prospect', 'inactive');