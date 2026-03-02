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
  mode: "generate" | "regenerate" | "clone";
  base_summary?: string | null;
  strategy_settings?: Record<string, unknown> | null;
}

interface WinThemePayloadKeyMove {
  title: string;
  description: string;
  timeframe?: string;
  owner_hint?: string;
}

interface WinThemePayloadRisk {
  risk: string;
  likelihood?: string;
  impact?: string;
  mitigation_strategy: string;
}

interface WinThemePayloadProposalArchitecture {
  recommended_structure: string;
  must_hit_messages?: string[];
  evidence_to_show?: string[];
}

interface WinThemePayloadStakeholderStrategy {
  key_stakeholder_groups?: string[];
  engagement_tactics?: string[];
}

interface WinThemePayloadTalkTracks {
  meeting_openers?: string[];
  email_subject_ideas?: string[];
  email_hook_paragraph?: string;
}

interface WinThemePayload {
  executive_win_theme: string;
  client_context_insight: string;
  value_narrative: string;
  key_moves: WinThemePayloadKeyMove[];
  risks_and_objections: WinThemePayloadRisk[];
  proposal_architecture: WinThemePayloadProposalArchitecture;
  stakeholder_strategy?: WinThemePayloadStakeholderStrategy;
  talk_tracks_and_openers?: WinThemePayloadTalkTracks;
  gaps_and_unknowns: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as GenerateWinThemeRequestBody | null;

  if (!body || !body.opportunity || !body.opportunity.id || !body.mode) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const { opportunity, mode, base_summary, strategy_settings } = body;

  let companiesHouse: unknown = null;
  if (opportunity.company_number) {
    try {
      companiesHouse = await fetchCompaniesHouseProfile(opportunity.company_number);
    } catch (error) {
      console.error("Failed to fetch Companies House profile for Win Theme generation", {
        companyNumber: opportunity.company_number,
        error,
      });
    }
  }

  const executiveWinTheme = `Strategic approach for ${opportunity.name}`;
  const clientName = opportunity.company_name ?? "the client";

  const payload: WinThemePayload = {
    executive_win_theme: executiveWinTheme,
    client_context_insight: `Working hypothesis about ${clientName}, based on the information currently available in Conexa for this opportunity.`,
    value_narrative: `High-level value story describing how our approach helps ${clientName} achieve its desired outcomes on ${opportunity.name}. Refine this once the full Win Theme engine is connected.`,
    key_moves: [],
    risks_and_objections: [],
    proposal_architecture: {
      recommended_structure:
        "Use this section as a placeholder for your proposal architecture. Once the Win Theme engine is wired up, this will be populated automatically.",
      must_hit_messages: [],
      evidence_to_show: [],
    },
    stakeholder_strategy: {
      key_stakeholder_groups: [],
      engagement_tactics: [],
    },
    talk_tracks_and_openers: {
      meeting_openers: [],
      email_subject_ideas: [],
      email_hook_paragraph:
        "Use this placeholder email hook paragraph until the Win Theme engine is connected. Tailor it to the client and opportunity.",
    },
    gaps_and_unknowns: [],
  };

  const summary = base_summary ?? executiveWinTheme;

  const contextBundle = {
    opportunity,
    mode,
    base_summary: summary,
    companies_house: companiesHouse,
  };

  return res.status(200).json({
    payload,
    summary,
    strategy_settings: strategy_settings ?? {},
    context_bundle: contextBundle,
  });
}