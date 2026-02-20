import { supabase } from "@/integrations/supabase/client";

export interface LeagueTableEntry {
  id: string;
  contractor_id: string;
  rank_position: number;
  fit_reason: string;
  created_at: string;
  contractor: {
    id: string;
    name: string;
    region: string;
    postcode: string;
    sic_code: string;
    employees: number;
    turnover_gbp: number;
    notes: string;
    enhancement_confidence: number | null;
    last_enhanced_at: string | null;
    radar_score?: number | null;
    company_number?: string | null;
    website_clean?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

export async function getLeagueTable(): Promise<LeagueTableEntry[]> {
  // First, get all league table entries
  const { data: leagueEntries, error: leagueError } = await supabase
    .from("me_contractor_league_table")
    .select(`
      id,
      contractor_id,
      rank_position,
      fit_reason,
      created_at
    `)
    .order("rank_position", { ascending: true });

  if (leagueError) {
    console.error("Error fetching league table entries:", leagueError);
    throw leagueError;
  }

  // Then, get all contractors from the radar view
  const { data: contractors, error: contractorsError } = await supabase
    .from("me_contractor_radar_view")
    .select(`
      id,
      name,
      region,
      postcode,
      sic_code,
      employees,
      turnover_gbp,
      notes,
      enhancement_confidence,
      last_enhanced_at,
      radar_score,
      company_number,
      website_clean,
      email,
      phone
    `);

  if (contractorsError) {
    console.error("Error fetching contractors:", contractorsError);
    throw contractorsError;
  }

  // Combine the data
  const contractorMap = new Map<string, any>();
  contractors.forEach((c) => {
    contractorMap.set(c.id, c);
  });

  const combinedData = leagueEntries.map((entry) => {
    const contractor = contractorMap.get(entry.contractor_id);
    return {
      ...entry,
      contractor,
    };
  });

  return combinedData || [];
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