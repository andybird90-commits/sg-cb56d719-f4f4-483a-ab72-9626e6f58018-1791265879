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

interface GeneratedWinThemeResult {
  payload: WinThemePayload;
  summary: string;
}

async function generateWinThemeWithLLM(params: {
  opportunity: GenerateWinThemeRequestBody["opportunity"];
  mode: GenerateWinThemeRequestBody["mode"];
  baseSummary: string;
  companiesHouse: unknown;
  strategySettings: Record<string, unknown> | null | undefined;
}): Promise<GeneratedWinThemeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn(
      "[win-theme] OPENAI_API_KEY not set. Falling back to placeholder Win Theme generation."
    );
    return null;
  }

  const { opportunity, mode, baseSummary, companiesHouse, strategySettings } = params;

  const systemPrompt =
    "You are an expert bid strategy consultant creating highly practical, concise Win Themes for professional services proposals. " +
    "You MUST respond with STRICT JSON that matches the WinThemePayload TypeScript structure provided. " +
    "Do not include any explanations, markdown, or extra keys. Only return JSON.";

  const context = {
    opportunity,
    mode,
    base_summary: baseSummary,
    companies_house: companiesHouse,
    strategy_settings: strategySettings ?? {},
  };

  const userPrompt =
    "Using the following context from a bid management system, create a complete Win Theme.\n\n" +
    "CONTEXT (JSON):\n" +
    JSON.stringify(context, null, 2) +
    "\n\n" +
    "Return ONLY a JSON object with this exact shape (TypeScript-style):\n" +
    `{
  "executive_win_theme": string,
  "client_context_insight": string,
  "value_narrative": string,
  "key_moves": {
    "title": string,
    "description": string,
    "timeframe"?: string,
    "owner_hint"?: string
  }[],
  "risks_and_objections": {
    "risk": string,
    "likelihood"?: string,
    "impact"?: string,
    "mitigation_strategy": string
  }[],
  "proposal_architecture": {
    "recommended_structure": string,
    "must_hit_messages"?: string[],
    "evidence_to_show"?: string[]
  },
  "stakeholder_strategy"?: {
    "key_stakeholder_groups"?: string[],
    "engagement_tactics"?: string[]
  },
  "talk_tracks_and_openers"?: {
    "meeting_openers"?: string[],
    "email_subject_ideas"?: string[],
    "email_hook_paragraph"?: string
  },
  "gaps_and_unknowns": string[]
}
` +
    "Guidelines:\n" +
    "- Be specific and grounded in the opportunity/company context provided.\n" +
    "- Executive win theme should be 1–3 punchy sentences, not a paragraph of fluff.\n" +
    "- Key moves should be concrete actions the team can take.\n" +
    "- Risks must be realistic objections or delivery risks, each with a mitigation.\n" +
    "- Proposal architecture should read like a recommended section outline.\n" +
    "- If some sections are not relevant, still return them but keep arrays short.\n";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[win-theme] OpenAI API error", {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[win-theme] OpenAI response missing content", { data });
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[win-theme] Failed to parse OpenAI JSON content", {
        content,
        error: parseError,
      });
      return null;
    }

    const payload = parsed as WinThemePayload;
    const summary =
      (payload && typeof payload.executive_win_theme === "string"
        ? payload.executive_win_theme
        : baseSummary) || baseSummary;

    return { payload, summary };
  } catch (error) {
    console.error("[win-theme] Error calling OpenAI", { error });
    return null;
  }
}

function buildPlaceholderPayload(opportunity: GenerateWinThemeRequestBody["opportunity"]): {
  payload: WinThemePayload;
  summary: string;
} {
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

  const summary = executiveWinTheme;

  return { payload, summary };
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

  const baseSummary = base_summary ?? `Strategic approach for ${opportunity.name}`;

  let generated = null as GeneratedWinThemeResult | null;
  try {
    generated = await generateWinThemeWithLLM({
      opportunity,
      mode,
      baseSummary,
      companiesHouse,
      strategySettings: strategy_settings,
    });
  } catch (error) {
    console.error("[win-theme] Unexpected error during LLM generation", { error });
  }

  const result = generated ?? buildPlaceholderPayload(opportunity);
  const { payload, summary } = result;

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