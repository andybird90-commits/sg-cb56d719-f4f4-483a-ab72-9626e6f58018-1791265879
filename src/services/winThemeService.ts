import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type WinThemeTable = Database["public"]["Tables"]["win_themes"];
export type WinThemeRow = WinThemeTable["Row"];

export type StrategySettings = Record<string, unknown>;

export interface CreateWinThemeParams {
  opportunityId: string;
  generatedByUserId: string;
  strategySettings: StrategySettings;
  payload: unknown;
  summary: string;
}

export interface UpdateWinThemeParams {
  id: string;
  payload: unknown;
  summary: string;
}

export async function createWinTheme(params: CreateWinThemeParams) {
  const { opportunityId, generatedByUserId, strategySettings, payload, summary } = params;

  const insertData: WinThemeTable["Insert"] = {
    opportunity_id: opportunityId,
    generated_by_user_id: generatedByUserId,
    strategy_settings: strategySettings as WinThemeTable["Insert"]["strategy_settings"],
    payload: payload as WinThemeTable["Insert"]["payload"],
    summary,
  };

  const { data, error } = await supabase
    .from("win_themes")
    .insert(insertData)
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

  return data as WinThemeRow | null;
}