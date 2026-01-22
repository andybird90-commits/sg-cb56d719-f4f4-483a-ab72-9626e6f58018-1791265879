import { supabase as client } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

// Re-export the singleton client to ensure only one instance exists app-wide
export const supabase = client;

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectActivity = Database["public"]["Tables"]["project_activities"]["Row"];
export type Variation = Database["public"]["Tables"]["variations"]["Row"];
export type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"];
export type SubcontractorCost = Database["public"]["Tables"]["subcontractor_costs"]["Row"];
export type MonthlyBudget = Database["public"]["Tables"]["monthly_budgets"]["Row"];
export type Absence = Database["public"]["Tables"]["absences"]["Row"];