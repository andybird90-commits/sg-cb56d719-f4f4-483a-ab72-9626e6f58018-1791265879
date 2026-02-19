import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ContractorRadarView = Database["public"]["Views"]["me_contractor_radar_view"]["Row"];

export interface ContractorFilters {
  regions?: string[];
  sic?: string[];
  minScore?: number;
  maxScore?: number;
  hasEmail?: boolean;
  hasWebsite?: boolean;
  limit?: number;
  offset?: number;
  searchTerm?: string;
  status?: string[];
}

export interface ContractorListItem {
  id: string;
  name: string;
  region: string | null;
  postcode: string | null;
  sic_code: string | null;
  radar_score: number;
  enhancement_confidence: number | null;
  last_enhanced_at: string | null;
  website_clean: string | null;
  employees_band: string | null;
  turnover_band: string | null;
  markets: string[] | null;
  capabilities: string[] | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  company_number: string | null;
}

export async function getContractorRadarList(
  filters: ContractorFilters = {}
): Promise<{ data: ContractorListItem[]; error: Error | null; count: number | null }> {
  try {
    let query = supabase
      .from("me_contractor_radar_view")
      .select("*", { count: "exact" });

    // Apply filters
    if (filters.regions && filters.regions.length > 0) {
      query = query.in("region", filters.regions);
    }

    if (filters.sic && filters.sic.length > 0) {
      query = query.in("sic_code", filters.sic);
    }

    if (filters.minScore !== undefined) {
      query = query.gte("radar_score", filters.minScore);
    }

    if (filters.maxScore !== undefined) {
      query = query.lte("radar_score", filters.maxScore);
    }

    if (filters.hasEmail === true) {
      query = query.not("email", "is", null);
    }

    if (filters.hasWebsite === true) {
      query = query.not("website_clean", "is", null);
    }

    if (filters.searchTerm) {
      query = query.ilike("name", `%${filters.searchTerm}%`);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }

    // Apply pagination
    if (filters.offset !== undefined) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1
      );
    } else if (filters.limit !== undefined) {
      query = query.limit(filters.limit);
    }

    // Order by radar score descending
    query = query.order("radar_score", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching contractor radar list:", error);
      return { data: [], error: new Error(error.message), count: 0 };
    }

    return {
      data: (data || []) as ContractorListItem[],
      error: null,
      count: count || 0,
    };
  } catch (error) {
    console.error("Error in getContractorRadarList:", error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error("Unknown error"),
      count: 0,
    };
  }
}

export interface NameCorrectionResult {
  id: string;
  old_name: string | null;
  new_name: string | null;
  reason?: string;
}

export interface NameCorrectionResponse {
  count_corrected: number;
  count_skipped: number;
  corrected_list: NameCorrectionResult[];
}

export async function correctCompanyNames(
  contractorIds: string[]
): Promise<NameCorrectionResponse> {
  const results: NameCorrectionResult[] = [];
  let count_corrected = 0;
  let count_skipped = 0;

  for (const contractorId of contractorIds) {
    try {
      // 1. Load contractor
      const { data: contractor, error: fetchError } = await supabase
        .from("me_contractors")
        .select("id, name, company_number, companies_house_raw")
        .eq("id", contractorId)
        .single();

      if (fetchError || !contractor) {
        count_skipped++;
        results.push({
          id: contractorId,
          old_name: null,
          new_name: null,
          reason: "Contractor not found",
        });
        continue;
      }

      // 2. Check if company_number exists
      if (!contractor.company_number || contractor.company_number.trim() === "") {
        count_skipped++;
        results.push({
          id: contractorId,
          old_name: contractor.name,
          new_name: null,
          reason: "No company number",
        });
        continue;
      }

      // 3. Call Companies House API
      const apiKey = process.env.NEXT_PUBLIC_COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        count_skipped++;
        results.push({
          id: contractorId,
          old_name: contractor.name,
          new_name: null,
          reason: "API key not configured",
        });
        continue;
      }

      const chResponse = await fetch(
        `https://api.company-information.service.gov.uk/company/${contractor.company_number}`,
        {
          headers: {
            Authorization: `Basic ${btoa(apiKey + ":")}`,
          },
        }
      );

      if (!chResponse.ok) {
        count_skipped++;
        results.push({
          id: contractorId,
          old_name: contractor.name,
          new_name: null,
          reason: `Companies House API error: ${chResponse.status}`,
        });
        continue;
      }

      const chData = await chResponse.json();
      const officialName = chData.company_name;

      if (!officialName) {
        count_skipped++;
        results.push({
          id: contractorId,
          old_name: contractor.name,
          new_name: null,
          reason: "No company name in CH response",
        });
        continue;
      }

      // 4. Update contractor name
      const oldName = contractor.name;

      // Merge companies_house_raw
      const rawData = contractor.companies_house_raw || {};
      const oldNames = Array.isArray(rawData.old_names) ? rawData.old_names : [];
      oldNames.push(oldName);

      const updatedRaw = {
        ...rawData,
        old_names: oldNames,
        last_ch_lookup: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("me_contractors")
        .update({
          name: officialName,
          companies_house_raw: updatedRaw,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contractorId);

      if (updateError) {
        count_skipped++;
        results.push({
          id: contractorId,
          old_name: oldName,
          new_name: null,
          reason: `Update failed: ${updateError.message}`,
        });
        continue;
      }

      // Success
      count_corrected++;
      results.push({
        id: contractorId,
        old_name: oldName,
        new_name: officialName,
      });
    } catch (error) {
      count_skipped++;
      results.push({
        id: contractorId,
        old_name: null,
        new_name: null,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    count_corrected,
    count_skipped,
    corrected_list: results,
  };
}