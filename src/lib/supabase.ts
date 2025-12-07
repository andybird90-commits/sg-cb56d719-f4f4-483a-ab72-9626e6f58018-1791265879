import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectActivity = Database["public"]["Tables"]["project_activities"]["Row"];
export type Variation = Database["public"]["Tables"]["variations"]["Row"];
export type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"];
export type SubcontractorCost = Database["public"]["Tables"]["subcontractor_costs"]["Row"];