import type { NextApiRequest, NextApiResponse } from "next";

interface OpportunityInput {
  id: string;
  name: string;
  project_reference?: string | null;
  company_name?: string | null;
  company_number?: string | null;
}

type GenerateMode = "generate" | "regenerate" | "clone";

interface GenerateRequestBody {
  mode: GenerateMode;
  opportunity: OpportunityInput;
  base?:
    | {
        summary?: string | null;
        payload?: unknown;
      }
    | null;
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

interface StrategySettings {
  mode: GenerateMode;
  version: number;
}

interface CompaniesHouseSource {
  error?: boolean;
  message?: string;
  status?: number;
  company_number?: string;
  company_name?: string;
  company_status?: string;
  date_of_creation?: string;
  registered_office_address?:
    | {
        [key: string]: unknown;
      }
    | null;
  sic_codes?: string[] | null;
}

interface GenerateWinThemeResponse {
  payload: WinThemePayload;
  summary: string;
  strategy_settings: StrategySettings;
  context_bundle?: {
    opportunity: OpportunityInput;
    base_summary: string | null;
    generated_mode: GenerateMode;
    companies_house: CompaniesHouseSource | null;
  };
}

async function fetchCompaniesHouseData(
  companyNumber: string | null | undefined,
): Promise<CompaniesHouseSource | null> {
  if (!companyNumber || companyNumber.trim() === "") {
    return null;
  }

  const apiKey = process.env.NEXT_PUBLIC_COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return {
      error: true,
      message: "Companies House API key is not configured.",
    };
  }

  const authHeader = Buffer.from(`${apiKey}:`).toString("base64");

  try {
    const response = await fetch(
      `https://api.company-information.service.gov.uk/company/${encodeURIComponent(
        companyNumber,
      )}`,
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      },
    );

    if (!response.ok) {
      return {
        error: true,
        status: response.status,
        message: `Companies House API error ${response.status}`,
        company_number: companyNumber,
      };
    }

    const json = (await response.json()) as Record<string, unknown>;
    const registeredOffice =
      (json.registered_office_address as {
        [key: string]: unknown;
      } | null) ?? null;
    const sicCodes = (json.sic_codes as string[] | undefined) ?? null;

    return {
      company_number:
        (json.company_number as string | undefined) ?? companyNumber,
      company_name: (json.company_name as string | undefined) ?? null,
      company_status: (json.company_status as string | undefined) ?? null,
      date_of_creation:
        (json.date_of_creation as string | undefined) ?? null,
      registered_office_address: registeredOffice,
      sic_codes: sicCodes,
    };
  } catch (error) {
    return {
      error: true,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected error calling Companies House.",
      company_number: companyNumber,
    };
  }
}

async function callOpenAIForWinTheme(
  body: GenerateRequestBody,
): Promise<GenerateWinThemeResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const companiesHouse = await fetchCompaniesHouseData(
    body.opportunity.company_number ?? null,
  );

  const systemPrompt =
    "You are a senior bid strategist creating concise, evidence-based win themes for MEP design opportunities. " +
    "Return ONLY JSON matching the requested schema. Do not include explanations or markdown.";

  const userPrompt = [
    "Generate a win theme strategy JSON for the following opportunity.",
    "",
    "Opportunity context:",
    JSON.stringify(body.opportunity),
    "",
    body.base
      ? "Previous or base strategy (may be empty): " +
        JSON.stringify(body.base)
      : "No previous strategy provided.",
    "",
    "Additional context from Companies House (if available):",
    JSON.stringify(
      companiesHouse ?? {
        note: "No Companies House data available for this opportunity.",
      },
    ),
    "",
    "Mode: " + body.mode,
    "",
    "Return JSON with this exact structure:",
    `{
  "executive_win_theme": string,
  "client_context_insight": string,
  "value_narrative": string,
  "key_moves": [
    {
      "title": string,
      "description": string,
      "timeframe"?: string,
      "owner_hint"?: string
    }
  ],
  "risks_and_objections": [
    {
      "risk": string,
      "likelihood"?: string,
      "impact"?: string,
      "mitigation_strategy": string
    }
  ],
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
}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} - ${text}`,
    );
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response was empty.");
  }

  let payload: WinThemePayload;
  try {
    payload = JSON.parse(content) as WinThemePayload;
  } catch {
    throw new Error("Failed to parse OpenAI JSON response.");
  }

  const strategy_settings: StrategySettings = {
    mode: body.mode,
    version: 1,
  };

  const summary = payload.executive_win_theme;

  const context_bundle = {
    opportunity: body.opportunity,
    base_summary: body.base?.summary ?? null,
    generated_mode: body.mode,
    companies_house: companiesHouse,
  };

  return {
    payload,
    summary,
    strategy_settings,
    context_bundle,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const body = req.body as GenerateRequestBody;

    if (!body || !body.opportunity || !body.mode) {
      res.status(400).send("Missing required fields: mode and opportunity.");
      return;
    }

    const result = await callOpenAIForWinTheme(body);

    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error generating win theme.";
    res.status(500).send(message);
  }
}