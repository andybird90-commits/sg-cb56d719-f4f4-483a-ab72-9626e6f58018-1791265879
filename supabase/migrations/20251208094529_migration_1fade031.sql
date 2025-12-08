-- Add holiday allocation columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS annual_holiday_days integer DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS holiday_cost_rate numeric;