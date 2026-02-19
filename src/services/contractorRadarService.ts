import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ContractorRadarView = Database["public"]["Views"]["me_contractor_radar_view"]["Row"];

export interface ContractorRadarFilters {
  regions?: string[];
  capabilities?: string[];
  status?: string[];
  minScore?: number;
  limit?: number;
  offset?: number;
}

export interface ContractorRadarResponse {
  data: ContractorRadarView[];
  count: number;
  error: string | null;
}

export const contractorRadarService = {
  async fetchContractors(filters: ContractorRadarFilters = {}): Promise<ContractorRadarResponse> {
    try {
      let query = supabase
        .from("me_contractor_radar_view")
        .select("*", { count: "exact" });

      // Apply filters
      if (filters.regions && filters.regions.length > 0) {
        query = query.in("region", filters.regions);
      }

      if (filters.status && filters.status.length > 0) {
        query = query.in("status", filters.status);
      }

      if (filters.minScore !== undefined) {
        query = query.gte("radar_score", filters.minScore);
      }

      // Filter by capabilities (array contains)
      if (filters.capabilities && filters.capabilities.length > 0) {
        query = query.contains("capabilities", filters.capabilities);
      }

      // Pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      query = query.range(offset, offset + limit - 1);

      // Order by radar score descending
      query = query.order("radar_score", { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching contractors:", error);
        return { data: [], count: 0, error: error.message };
      }

      return { data: data || [], count: count || 0, error: null };
    } catch (err) {
      console.error("Unexpected error:", err);
      return { data: [], count: 0, error: "An unexpected error occurred" };
    }
  },

  async fetchContractorDetails(contractorId: string) {
    try {
      // Fetch contractor
      const { data: contractor, error: contractorError } = await supabase
        .from("me_contractors")
        .select("*")
        .eq("id", contractorId)
        .single();

      if (contractorError) throw contractorError;

      // Fetch contacts
      const { data: contacts, error: contactsError } = await supabase
        .from("me_contractor_contacts")
        .select("*")
        .eq("contractor_id", contractorId);

      if (contactsError) throw contactsError;

      // Fetch capabilities
      const { data: capabilities, error: capabilitiesError } = await supabase
        .from("me_contractor_capabilities")
        .select("*")
        .eq("contractor_id", contractorId);

      if (capabilitiesError) throw capabilitiesError;

      // Fetch relationships
      const { data: relationships, error: relationshipsError } = await supabase
        .from("me_contractor_relationships")
        .select("*")
        .eq("contractor_id", contractorId)
        .order("interaction_date", { ascending: false });

      if (relationshipsError) throw relationshipsError;

      // Fetch radar score
      const { data: radarScore, error: radarError } = await supabase
        .from("me_contractor_radar_scores")
        .select("*")
        .eq("contractor_id", contractorId)
        .single();

      if (radarError && radarError.code !== "PGRST116") throw radarError;

      return {
        contractor,
        contacts: contacts || [],
        capabilities: capabilities || [],
        relationships: relationships || [],
        radarScore: radarScore || null,
        error: null
      };
    } catch (err: any) {
      console.error("Error fetching contractor details:", err);
      return {
        contractor: null,
        contacts: [],
        capabilities: [],
        relationships: [],
        radarScore: null,
        error: err.message
      };
    }
  },

  async recalculateRadarScore(contractorId: string) {
    try {
      const { data, error } = await supabase.functions.invoke("recalculate-contractor-radar-score", {
        body: { contractor_id: contractorId }
      });

      if (error) throw error;

      return { success: true, data, error: null };
    } catch (err: any) {
      console.error("Error recalculating radar score:", err);
      return { success: false, data: null, error: err.message };
    }
  },

  async updateContractorStatus(contractorId: string, status: string) {
    try {
      const { error } = await supabase
        .from("me_contractors")
        .update({ status })
        .eq("id", contractorId);

      if (error) throw error;

      return { success: true, error: null };
    } catch (err: any) {
      console.error("Error updating contractor status:", err);
      return { success: false, error: err.message };
    }
  }
};