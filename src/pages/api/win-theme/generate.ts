import type { NextApiRequest, NextApiResponse } from "next";
import { fetchCompaniesHouseProfile } from "@/services/contractorDataService";

interface GenerateWinThemeRequestBody {
  opportunity: {
    id: string;
    name: string;
    project_reference?: string | null;
    company_name?: string | null;
    company_number?: string | null;
  };
  mode: "generate" | "regenerate";
  base_summary?: string | null;
  strategy_settings?: Record<string, unknown> | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as GenerateWinThemeRequestBody | null;

  // Be strict only on fields we always send from the page:
  if (!body || !body.opportunity || !body.opportunity.id || !body.mode) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const { opportunity, mode, base_summary, strategy_settings } = body;

  // Optional: base_summary and strategy_settings can be null/undefined, do not 400 on them.

  // Companies House lookup (optional, safe failure)
  let companiesHouse: unknown = null;
  if (opportunity.company_number) {
    companiesHouse = await fetchCompaniesHouseProfile(opportunity.company_number);
  }

  const contextBundle = {
    opportunity,
    mode,
    base_summary: base_summary ?? null,
    companies_house: companiesHouse,
  };

  // Call your existing OpenAI / generation logic here (omitted for brevity)
  // Assume we get 'payload' and 'summary' back:
  const payload = {
    opportunity,
    strategy_settings: strategy_settings ?? null,
    companies_house: companiesHouse,
  };

  const summary = base_summary ?? "Generated win theme summary";

  return res.status(200).json({
    payload,
    summary,
    strategy_settings: strategy_settings ?? {},
    context_bundle: contextBundle,
  });
}