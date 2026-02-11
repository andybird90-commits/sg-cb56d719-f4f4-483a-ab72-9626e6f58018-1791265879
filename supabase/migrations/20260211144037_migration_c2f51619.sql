-- Add new columns to monthly_budgets table for overhead and total staff cost
ALTER TABLE monthly_budgets 
ADD COLUMN IF NOT EXISTS overhead numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_staff_cost numeric DEFAULT 0;