import { supabase } from "@/integrations/supabase/client";

export interface LeagueTableEntry {
  id: string;
  contractor_id: string;
  rank_position: number;
  fit_reason: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  contractor?: {
    id: string;
    name: string;
    region: string | null;
    postcode: string | null;
    sic_code: string | null;
    address: string | null;
    employees: number | null;
    turnover_gbp: number | null;
    notes: string | null;
    enhancement_confidence: number | null;
    last_enhanced_at: string | null;
  };
}

export async function getLeagueTable(): Promise<LeagueTableEntry[]> {
  const { data, error } = await supabase
    .from("me_contractor_league_table")
    .select(`
      *,
      contractor:me_contractors(
        id,
        name,
        region,
        postcode,
        sic_code,
        address,
        employees,
        turnover_gbp,
        notes,
        enhancement_confidence,
        last_enhanced_at
      )
    `)
    .order("rank_position", { ascending: true });

  if (error) {
    console.error("Error fetching league table:", error);
    throw error;
  }

  return data || [];
}

export async function addToLeagueTable(
  contractorId: string,
  fitReason: string
): Promise<void> {
  // Get current max rank
  const { data: maxRank } = await supabase
    .from("me_contractor_league_table")
    .select("rank_position")
    .order("rank_position", { ascending: false })
    .limit(1)
    .single();

  const newRank = (maxRank?.rank_position || 0) + 1;

  const { error } = await supabase
    .from("me_contractor_league_table")
    .insert({
      contractor_id: contractorId,
      rank_position: newRank,
      fit_reason: fitReason,
    });

  if (error) {
    console.error("Error adding to league table:", error);
    throw error;
  }
}

export async function removeFromLeagueTable(entryId: string): Promise<void> {
  const { error } = await supabase
    .from("me_contractor_league_table")
    .delete()
    .eq("id", entryId);

  if (error) {
    console.error("Error removing from league table:", error);
    throw error;
  }

  // Reorder remaining entries
  await reorderLeagueTable();
}

export async function moveContractorUp(entryId: string): Promise<void> {
  const { data: currentEntry } = await supabase
    .from("me_contractor_league_table")
    .select("*")
    .eq("id", entryId)
    .single();

  if (!currentEntry || currentEntry.rank_position <= 1) return;

  // Find entry above
  const { data: aboveEntry } = await supabase
    .from("me_contractor_league_table")
    .select("*")
    .eq("rank_position", currentEntry.rank_position - 1)
    .single();

  if (!aboveEntry) return;

  // Swap ranks
  await supabase
    .from("me_contractor_league_table")
    .update({ rank_position: aboveEntry.rank_position })
    .eq("id", currentEntry.id);

  await supabase
    .from("me_contractor_league_table")
    .update({ rank_position: currentEntry.rank_position })
    .eq("id", aboveEntry.id);
}

export async function moveContractorDown(entryId: string): Promise<void> {
  const { data: currentEntry } = await supabase
    .from("me_contractor_league_table")
    .select("*")
    .eq("id", entryId)
    .single();

  if (!currentEntry) return;

  // Find entry below
  const { data: belowEntry } = await supabase
    .from("me_contractor_league_table")
    .select("*")
    .eq("rank_position", currentEntry.rank_position + 1)
    .single();

  if (!belowEntry) return;

  // Swap ranks
  await supabase
    .from("me_contractor_league_table")
    .update({ rank_position: belowEntry.rank_position })
    .eq("id", currentEntry.id);

  await supabase
    .from("me_contractor_league_table")
    .update({ rank_position: currentEntry.rank_position })
    .eq("id", belowEntry.id);
}

export async function updateFitReason(
  entryId: string,
  fitReason: string
): Promise<void> {
  const { error } = await supabase
    .from("me_contractor_league_table")
    .update({ fit_reason: fitReason })
    .eq("id", entryId);

  if (error) {
    console.error("Error updating fit reason:", error);
    throw error;
  }
}

async function reorderLeagueTable(): Promise<void> {
  const { data: entries } = await supabase
    .from("me_contractor_league_table")
    .select("id")
    .order("rank_position", { ascending: true });

  if (!entries) return;

  // Update ranks sequentially
  for (let i = 0; i < entries.length; i++) {
    await supabase
      .from("me_contractor_league_table")
      .update({ rank_position: i + 1 })
      .eq("id", entries[i].id);
  }
}