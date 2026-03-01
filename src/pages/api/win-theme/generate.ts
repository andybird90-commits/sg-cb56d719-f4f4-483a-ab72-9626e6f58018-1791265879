import type { NextApiRequest, NextApiResponse } from "next";
import { fetchCompaniesHouseProfile } from "@/services/contractorDataService";
import { supabase } from "@/integrations/supabase/client";
import { createWinTheme, type WinThemeContextBundle } from "@/services/winThemeService";

interface GenerateWinThemeBody {
  opportunity_id: string;
  generated_by_user_id: string;
  strategy_settings: Record<string, unknown> | null;
  base_summary?: string | null;
  mode?: "generate" | "regenerate" | "clone";
}

async function getOpportunityWithCompany(opportunityId: string) {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*, companies ( id, name, company_number )")
    .eq("id", opportunityId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching opportunity for win theme", error);
    throw error;
  }

  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const body = req.body as GenerateWinThemeBody;

    if (!body.opportunity_id || !body.generated_by_user_id) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const opportunity = await getOpportunityWithCompany(body.opportunity_id);

    let companiesHouseSummary: WinThemeContextBundle["companies_house"] = null;

    const companyNumber =
      (opportunity as any)?.companies?.company_number ??
      (opportunity as any)?.company_number ??
      null;

    if (companyNumber) {
      companiesHouseSummary = await fetchCompaniesHouseProfile(companyNumber);
    }

    const contextBundle: WinThemeContextBundle = {
      opportunity,
      generated_mode: body.mode ?? "generate",
      base_summary: body.base_summary ?? null,
      companies_house: companiesHouseSummary,
    };

    const payload: Record<string, unknown> = {
      opportunity,
      strategy_settings: body.strategy_settings ?? {},
      companies_house: companiesHouseSummary,
    };

    const winTheme = await createWinTheme({
      opportunity_id: body.opportunity_id,
      generated_by_user_id: body.generated_by_user_id,
      strategy_settings: (body.strategy_settings ?? {}) as any,
      payload: payload as any,
      summary: body.base_summary ?? null,
      contextBundle,
    });

    return res.status(200).json({ winTheme });
  } catch (error: unknown) {
    console.error("Win theme generation error", error);
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? (error as { message?: string }).message ?? "Unknown error generating win theme."
        : "Unknown error generating win theme.";
    return res.status(500).json({ error: message });
  }
}