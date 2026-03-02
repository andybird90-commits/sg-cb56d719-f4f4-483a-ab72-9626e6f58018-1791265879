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
  blocker_context?: {
    latest_description?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };
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

  let query = queryParts.join(" ").trim();

  if (!query) {
    if (opportunity.company_number) {
      query = `company ${opportunity.company_number}`;
    } else {
      query = "";
    }
  }

  const lowerQuery = query.toLowerCase();
  const meaninglessQueries = [
    "unknown opportunity",
    "unknown opportunities",
    "opportunity unknown",
    "tbc",
    "tba",
    "untitled opportunity",
    "new opportunity",
  ];

  if (!query || meaninglessQueries.includes(lowerQuery)) {
    return null;
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
  blockerContext?: {
    latest_description?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };
}): Promise<GeneratedWinThemeResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn(
      "[win-theme] OPENAI_API_KEY not set. Falling back to placeholder Win Theme generation."
    );
    return null;
  }

  const { opportunity, mode, baseSummary, companiesHouse, braveContext, strategySettings, blockerContext } =
    params;

  const systemPrompt =
    "You are an expert bid strategy consultant creating detailed, highly practical Win Themes for professional services and construction-related bids. " +
    "You are always advising the bidding organisation (our direct client) on how to win a specific opportunity with their customer. " +
    "Treat the bidding organisation represented in the opportunity/company data (for example, RJS Ventol) as 'we' / 'our team' / 'our organisation'. " +
    "Your primary audience is the customer's evaluation and decision-making group (for example, estates director, procurement lead, project sponsor, framework manager, finance lead), not end users such as students, patients, or residents. " +
    "When you refer to end users or ultimate beneficiaries (for example, students, patients, service users, local communities), describe them in the third person as groups that benefit from the customer's objectives – do not address them directly or write marketing copy aimed at them. " +
    "Write to the customer's decision-makers who are evaluating the bid, focusing on what matters to them in terms of assurance, value, delivery risk, governance, and strategic fit. End users or ultimate beneficiaries are secondary context unless the data explicitly shows our client is also the end user. " +
    "Where blocker_context is provided, treat it as fresh insight into what is currently stopping this opportunity from being secured, and integrate it into the executive win theme, risks, and key moves. " +
    "Use all contextual signals available (opportunity data from Conexa, Companies House data, Brave web search results, and strategy settings) to ground recommendations in real organisations, sectors, locations, and project types wherever possible. " +
    "When Brave web search results are present, treat them as your primary external evidence base: infer the customer's sector, service lines, recent projects, frameworks, and likely evaluation criteria from the titles and descriptions. Explicitly connect your recommendations back to that evidence (for example, referencing sector, geography, published strategies, frameworks, or common themes in news coverage). " +
    "When Companies House data is present, use it to infer size, status, longevity, SIC codes and risk profile, and reflect that explicitly in risks, mitigations, and our positioning. " +
    "Avoid generic consultancy buzzwords that could apply to any bid, such as 'unlock the full potential', 'world-class', 'cutting-edge', 'best-in-class', 'game-changing', 'holistic solutions', 'leveraging synergies', unless you immediately tie them to very specific, contextualised points from the data. Prefer plain, concrete language. " +
    "If key details are missing or obviously generic (for example the opportunity name is literally 'Unknown opportunity' or there is no identifiable client organisation), acknowledge that uncertainty clearly and treat this as an early-stage opportunity where the priority is targeted research and qualification, not polished marketing language. " +
    "Use the 'gaps_and_unknowns' section to propose specific research questions, buyer conversations, data checks, and validation steps rather than guessing at project specifics. " +
    "Prioritise concrete moves, risks, and messages that an experienced bid lead could action in the next 1–4 weeks. " +
    "Always use the opportunity name from the provided context when it exists to anchor your recommendations in this specific piece of work, rather than referring only to 'this project' in generic terms. " +
    "You MUST respond with STRICT JSON that matches the WinThemePayload TypeScript structure provided. " +
    "Do not include any explanations, markdown, or extra keys. Only return JSON.";

  const context = {
    opportunity,
    mode,
    base_summary: baseSummary,
    companies_house: companiesHouse,
    brave: braveContext,
    strategy_settings: strategySettings ?? {},
    blocker_context: blockerContext ?? null,
  };

  const userPrompt =
    "Using the following context from a bid management system, create a complete, evidence-based Win Theme.\n\n" +
    "The Win Theme MUST be written from the point of view of our direct client (the bidding organisation) winning this opportunity with their customer. " +
    "Treat the bidding organisation represented in the opportunity/company data (for example, RJS Ventol) as 'we' / 'our team'. " +
    "Write to the customer's decision-makers who are evaluating the bid, not to end users. Only treat end users as the primary client if the context clearly shows our client is also the end user.\n\n" +
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
    "Guidelines and minimum expectations:\n" +
    "- Executive win theme: 2–3 punchy sentences that clearly state why choosing our client for THIS opportunity is the safest, highest-value choice for the customer. Make the rationale specific to the sector, context, and delivery model. Avoid vague claims like 'unlock full potential' or 'world-class' unless immediately grounded in explicit context (for example, a specific programme, framework, or track record from the data).\n" +
    "- Client context insight: 1–3 short paragraphs summarising the situation, drivers, constraints and what matters most to the customer for this project. Use Companies House and Brave context where useful (for example, company size, financial health, SIC codes, geographic footprint, recent news, published strategies, or known strategic priorities). Make it obvious that you understand who the customer is and what environment they operate in.\n" +
    "- Value narrative: at least 2–3 short paragraphs that link our client's specific strengths to the customer's success criteria for this opportunity. Avoid generic statements like 'we provide innovative, tailored solutions'; instead, tie our strengths to the sector, geography, and delivery model implied by the context or web results.\n" +
    "- Key moves: at least 4–6 concrete, actionable moves the team can take to strengthen their position and win. Each move should be 2–3 sentences of detail, not just a label. Describe what to do, who should do it (by role, not name), what external or internal evidence it should lean on, and how it changes our win probability.\n" +
    "- Risks and objections: at least 3–5 realistic evaluation or delivery risks in the context of this bid, each with a specific, credible mitigation strategy. Refer explicitly to Companies House and Brave insights where relevant (for example concerns about financial resilience, capacity, past performance, or sector-specific delivery challenges).\n" +
    "- Proposal architecture: 1–2 paragraphs giving a clear recommended structure for the proposal or pitch, plus 'must_hit_messages' and 'evidence_to_show' lists where possible. Make sure the structure feels tailored to the opportunity type (for example framework mini-comp, design-and-build, consultancy call-off, etc.), using clues from opportunity data and web context.\n" +
    "- Stakeholder strategy: where relevant, identify key stakeholder groups (by role, such as estates director, framework manager, project sponsor, finance lead) and practical engagement tactics tailored to this opportunity and organisation. Use any Brave/Companies House context about scale, governance, or organisational structure to inform this.\n" +
    "- Talk tracks and openers: provide concrete meeting openers and email subject ideas that feel specific to this client and opportunity, plus a short, compelling email hook paragraph that a bid lead could paste into an outreach email. If Brave results suggest particular programmes, strategies, or locations, reflect that in the language.\n" +
    "- Ground your recommendations in the provided context. When Brave results are available, reference observable patterns from them (for example, the customer's published strategies, recent projects, or common themes in news coverage). When Companies House data is available, weave in what it suggests about scale, risk and sector.\n" +
    "- If the opportunity name is 'Unknown opportunity' or similarly generic, or if there is very little concrete project information, do NOT pretend to know specific details. Instead, keep the tone pragmatic and focus heavily on qualification, discovery, and shaping strategy: what should we find out, who should we speak to, and what hypotheses should we test. Use 'gaps_and_unknowns' to list at least 5–8 precise questions or actions that would materially improve our ability to win.\n" +
    "- Always favour specific, operational language over buzzwords. Write as if you are briefing an experienced bid director who expects clarity, not marketing copy.\n";

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
      blockerContext: body.blocker_context,
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