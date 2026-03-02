import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WinThemeTable = Database["public"]["Tables"]["win_themes"];
export type WinThemeRow = WinThemeTable["Row"];
export type StrategySettings = WinThemeTable["Row"]["strategy_settings"];

type Json = WinThemeTable["Row"]["payload"];

export interface WinThemeContextBundle {
  opportunity?: unknown;
  generated_mode?: string | null;
  base_summary?: string | null;
  companies_house?: {
    error?: boolean;
    status?: number;
    message?: string;
    company_number?: string | null;
    company_name?: string | null;
    company_status?: string | null;
    registered_office_address?: unknown;
    sic_codes?: string[] | null;
  } | null;
  brave?: unknown;
}

export interface CreateWinThemeInput {
  opportunity_id: string;
  generated_by_user_id: string;
  strategy_settings: StrategySettings | null;
  payload: any;
  summary: string | null;
  contextBundle?: WinThemeContextBundle | null;
}

export interface UpdateWinThemeParams {
  id: string;
  // Accept arbitrary structured payloads from the UI; they will be cast to the table's Json type when updating.
  payload: any;
  summary?: string | null;
}

export async function createWinTheme(input: CreateWinThemeInput) {
  const { contextBundle, ...rest } = input;

  const insert: WinThemeTable["Insert"] = {
    opportunity_id: rest.opportunity_id,
    generated_by_user_id: rest.generated_by_user_id,
    strategy_settings: rest.strategy_settings,
    payload: rest.payload,
    summary: rest.summary ?? null,
    context_bundle: (contextBundle ?? null) as WinThemeTable["Insert"]["context_bundle"],
  };

  const { data, error } = await supabase
    .from("win_themes")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    console.error("Error creating win theme", error);
    throw error;
  }

  return data as WinThemeRow;
}

export async function updateWinTheme(params: UpdateWinThemeParams) {
  const { id, payload, summary } = params;

  const updateData: WinThemeTable["Update"] = {
    payload: payload as WinThemeTable["Update"]["payload"],
    summary,
  };

  const { data, error } = await supabase
    .from("win_themes")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating win theme", { id, error });
    throw error;
  }

  return data as WinThemeRow;
}

export async function listWinThemesForOpportunity(opportunityId: string) {
  const { data, error } = await supabase
    .from("win_themes")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("generated_at", { ascending: false });

  if (error) {
    console.error("Error fetching win themes for opportunity", { opportunityId, error });
    throw error;
  }

  return (data ?? []) as WinThemeRow[];
}

export async function getLatestWinThemeForOpportunity(opportunityId: string) {
  const { data, error } = await supabase
    .from("win_themes")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching latest win theme for opportunity", { opportunityId, error });
    throw error;
  }

  return (data ?? null) as WinThemeRow | null;
}

export async function deleteWinTheme(id: string) {
  const { error } = await supabase
    .from("win_themes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting win theme", { id, error });
    throw error;
  }
}