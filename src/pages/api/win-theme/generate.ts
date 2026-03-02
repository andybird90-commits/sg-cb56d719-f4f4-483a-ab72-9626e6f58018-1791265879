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

interface BraveSearchSnippet {
  title: string;
  url: string;
  description: string;
}

interface BraveContext {
  query: string;
  results: BraveSearchSnippet[];
}

async function fetchBraveContext(
  opportunity: GenerateWinThemeRequestBody["opportunity"],
  companiesHouse: unknown
): Promise<BraveContext | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return null;
  }

  const queryParts: string[] = [];
  if (opportunity.name) {
    queryParts.push(opportunity.name);
  }
  if (opportunity.company_name) {
    queryParts.push(opportunity.company_name);
  }

  if (companiesHouse && typeof companiesHouse === "object" && "company_name" in companiesHouse) {
    const chName = (companiesHouse as { company_name?: string | null }).company_name;
    if (chName) {
      queryParts.push(chName);
    }
  }

  if (opportunity.project_reference) {
    queryParts.push(String(opportunity.project_reference));
  }

  let query = queryParts.join(" ");
  if (!query) {
    if (opportunity.company_number) {
      query = `company ${opportunity.company_number}`;
    } else {
      query = "tender opportunity construction professional services";
    }
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      {
        headers: {
          "X-Subscription-Token": apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error("[win-theme] Brave search API error", {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = (await response.json()) as {
      web?: {
        results?: {
          title?: string;
          url?: string;
          description?: string;
        }[];
      };
    };

    const resultsSource = Array.isArray(data.web?.results) ? data.web?.results : [];
    const results: BraveSearchSnippet[] = resultsSource
      .slice(0, 5)
      .map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        description: item.description ?? "",
      }))
      .filter((item) => item.title || item.description || item.url);

    if (results.length === 0) {
      return null;
    }

    return {
      query,
      results,
    };
  } catch (error) {
    console.error("[win-theme] Error calling Brave search API", { error });
    return null;
  }
}

async function generateWinThemeWithLLM(params: {
  opportunity: GenerateWinThemeRequestBody["opportunity"];
  mode: GenerateWinThemeRequestBody["mode"];
  baseSummary: string;
  companiesHouse: unknown;
  braveContext: BraveContext | null;
  strategySettings: Record<string, unknown> | null | undefined;
}): Promise<GeneratedWinThemeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn(
      "[win-theme] OPENAI_API_KEY not set. Falling back to placeholder Win Theme generation."
    );
    return null;
  }

  const { opportunity, mode, baseSummary, companiesHouse, braveContext, strategySettings } = params;

  const systemPrompt =
    "You are an expert bid strategy consultant creating detailed, highly practical Win Themes for professional services and construction-related proposals. " +
    "You are advising a bidding organisation (our direct client) on how to win a specific opportunity with their customer. " +
    "Always frame the Win Theme from the perspective of helping our direct client (the bidding organisation, typically opportunity.company_name) win the project and the evaluation. " +
    "End users or ultimate beneficiaries are secondary context, not the primary client, unless the data explicitly states that our client is also the end user. " +
    "Use all contextual signals available (opportunity data, company data, Companies House data, Brave web search results, strategy settings) to ground your recommendations in real organisations, sectors, locations, and project types wherever possible. " +
    "When Brave web search results are present, treat them as your primary external source of context: infer the customer's sector, service lines, recent projects, frameworks, and likely evaluation criteria from those snippets. " +
    "Explicitly connect your recommendations back to that evidence (e.g. referencing sector, geography, frameworks, typical challenges). " +
    "Avoid generic consultancy buzzwords that could apply to any bid (for example 'unlock full potential', 'world-class', 'cutting-edge', 'best-in-class') unless you immediately back them up with specific, contextual detail. " +
    "Prioritise concrete moves, risks, and messages that an experienced bid lead could action in the next 1–4 weeks. " +
    "If key details are missing or obviously generic (for example the opportunity name is literally 'Unknown opportunity'), acknowledge that uncertainty explicitly and use the gaps/unknowns section to propose targeted research questions and validation steps rather than guessing. " +
    "You MUST respond with STRICT JSON that matches the WinThemePayload TypeScript structure provided. " +
    "Do not include any explanations, markdown, or extra keys. Only return JSON.";

  const context = {
    opportunity,
    mode,
    base_summary: baseSummary,
    companies_house: companiesHouse,
    brave: braveContext,
    strategy_settings: strategySettings ?? {},
  };

  const userPrompt =
    "Using the following context from a bid management system, create a complete Win Theme.\n\n" +
    "The Win Theme MUST be written from the point of view of our direct client (the bidding organisation) winning this opportunity with their customer. " +
    "Treat the bidding organisation represented in the opportunity/company data (for example, RJS Ventol) as 'we' / 'our team'. " +
    "Write to the customer's decision-makers who are evaluating the bid.\n\n" +
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
    "- Executive win theme: 2–3 punchy sentences that clearly state why choosing our client for THIS opportunity is the safest, highest-value choice for the customer. Avoid empty praise and make the rationale specific to the sector, context, and delivery model.\n" +
    "- Client context insight: 1–2 short paragraphs summarising the situation, drivers, constraints and what matters most to the customer for this project. Use Companies House and Brave context where useful (for example, company size, financial health, SIC codes, geographic footprint, recent news, or known strategic priorities).\n" +
    "- Value narrative: several sentences (or 2–3 short paragraphs) that link our client's specific strengths to the customer's success criteria for this opportunity. Avoid generic statements; make it clearly about this opportunity and client, using any available web context to infer likely evaluation criteria and delivery risks.\n" +
    "- Key moves: at least 3–5 concrete, actionable moves the team can take to strengthen their position and win. Each move should be 2–3 sentences of detail, not just a label. Describe what to do, who should do it (by role, not name), and how it changes our win probability.\n" +
    "- Risks and objections: at least 3 realistic evaluation or delivery risks in the context of this bid, each with a specific, credible mitigation strategy. Refer to Companies House and Brave insights where relevant (for example concerns about financial resilience, capacity, past performance, or sector-specific delivery challenges).\n" +
    "- Proposal architecture: a clear recommended structure for the proposal or pitch (1–2 paragraphs plus specific must-hit messages and evidence where possible). Make sure the structure feels tailored to the opportunity type (for example framework mini-comp, design-and-build, consultancy call-off, etc.).\n" +
    "- Stakeholder strategy: where relevant, identify key stakeholder groups and practical engagement tactics tailored to this opportunity. Use plausible buyer-side roles (such as estates director, framework manager, project sponsor, finance lead) rather than personal names.\n" +
    "- Talk tracks and openers: provide concrete meeting openers and email subject ideas that feel specific to this client and opportunity, plus a short, compelling email hook paragraph that a bid lead could paste into an outreach email.\n" +
    "- Ground your recommendations in the provided context. When Brave results are available, reference observable patterns from them (for example, the customer's published strategies, recent projects, or common themes in news coverage).\n" +
    "- If some sections are genuinely not well-supported by the context (for example little or no detail about the project), keep them brief but still return them, and use the gaps_and_unknowns section to flag what information is missing and what research should be done next. Do not fabricate specific project details that are not implied by the context.\n";

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

  let braveContext: BraveContext | null = null;
  try {
    braveContext = await fetchBraveContext(opportunity, companiesHouse);
  } catch (error) {
    console.error("[win-theme] Unexpected error when fetching Brave context", { error });
  }

  let generated: GeneratedWinThemeResult | null = null;
  let generationSource: "llm" | "placeholder" = "placeholder";

  try {
    generated = await generateWinThemeWithLLM({
      opportunity,
      mode,
      baseSummary,
      companiesHouse,
      braveContext,
      strategySettings: strategy_settings,
    });
    if (generated) {
      generationSource = "llm";
    }
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
    brave: braveContext,
  };

  return res.status(200).json({
    payload,
    summary,
    strategy_settings: strategy_settings ?? {},
    context_bundle: contextBundle,
    generation_source: generationSource,
  });
}