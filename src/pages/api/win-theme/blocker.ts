import type { NextApiRequest, NextApiResponse } from "next";
import { fetchCompaniesHouseProfile } from "@/services/contractorDataService";

type BlockerChatRole = "user" | "assistant";

interface BlockerChatMessage {
  role: BlockerChatRole;
  content: string;
}

interface BlockerRequestOpportunity {
  id: string;
  name: string;
  project_reference?: string | null;
  company_name?: string | null;
  company_number?: string | null;
}

interface BlockerRequestBody {
  opportunity: BlockerRequestOpportunity;
  blocker_description: string;
  history?: BlockerChatMessage[];
}

interface BlockerResult {
  analysis: string;
  suggestions: string[];
  questions: string[];
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
  opportunity: BlockerRequestOpportunity,
  companiesHouse: unknown,
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

  if (!query && opportunity.company_number) {
    query = `company ${opportunity.company_number}`;
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

  const enrichedQuery = `${query} UK building services MEP`;

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(enrichedQuery)}&count=5`,
      {
        headers: {
          "X-Subscription-Token": apiKey,
        },
      },
    );

    if (!response.ok) {
      console.error("[win-theme-blocker] Brave search API error", {
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
      query: enrichedQuery,
      results,
    };
  } catch (error) {
    console.error("[win-theme-blocker] Error calling Brave search API", { error });
    return null;
  }
}

async function generateBlockerWithLLM(params: {
  opportunity: BlockerRequestOpportunity;
  blockerDescription: string;
  history: BlockerChatMessage[];
  companiesHouse: unknown;
  braveContext: BraveContext | null;
}): Promise<BlockerResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[win-theme-blocker] OPENAI_API_KEY not set. Falling back to placeholder blocker analysis.",
    );
    return null;
  }

  const { opportunity, blockerDescription, history, companiesHouse, braveContext } =
    params;

  const systemPrompt =
    "You are an expert bid strategy coach helping a team unblock specific issues that are stopping them from winning a live opportunity. " +
    "You always write from the perspective of the bidding organisation ('we' / 'our team') and you are advising them on how to respond to their customer's decision-makers. " +
    "You are based in the United Kingdom and should assume that all opportunities, clients, and delivery contexts are UK-based unless the provided data clearly states otherwise. " +
    "Use UK terminology, procurement routes, and regulatory references where helpful (for example UK building regulations, BS/EN standards, RIBA/RICS language, NHS and local authority contexts), and do not anchor your analysis or advice in non-UK jurisdictions. " +
    "The bidding organisation operates in building services MEP (mechanical, electrical, and public health engineering for buildings and estates), so you can be specific about MEP design, installation, commissioning, compliance, energy performance, and lifecycle maintenance when describing blockers and options. " +
    "When using Brave web search results, treat snippets that clearly relate to non-UK organisations or geographies as low-quality noise; do not base your reasoning on them, and if most results look non-UK, fall back to well-grounded, UK-appropriate building-services MEP assumptions instead. " +
    "Never address students, patients, residents, or other end users directly. When you mention them, describe them in the third person as groups that benefit from the customer's objectives. " +
    "Use all contextual signals available (opportunity data, Companies House data, Brave web search results, and the short blocker description) to ground your advice in the real organisation and opportunity wherever possible. " +
    "Focus on practical ways to reshape the customer's perception, de-risk their concerns, and strengthen our position over the next 1–4 weeks. " +
    "You MUST respond with STRICT JSON using the exact shape that will be provided. Do not include markdown or any keys that are not specified.";

  const context = {
    opportunity,
    blocker_description: blockerDescription,
    history,
    companies_house: companiesHouse,
    brave: braveContext,
  };

  const userPrompt =
    "You are helping a bid team think through a specific blocker that is threatening their ability to win this opportunity.\n\n" +
    "CONTEXT (JSON):\n" +
    JSON.stringify(context, null, 2) +
    "\n\n" +
    "Return ONLY a JSON object with this exact shape:\n" +
    `{
  "analysis": string,
  "suggestions": string[],
  "questions": string[]
}
` +
    "Guidelines:\n" +
    "- analysis: 1–3 short paragraphs explaining what is really going on with this blocker, framed from the customer's perspective and the bid team's position.\n" +
    "- suggestions: 4–6 concise, actionable steps the bid team can take. Each item should be specific enough that an experienced bid lead could act on it this week.\n" +
    "- questions: 4–6 precise questions the team should explore with the customer or internally to clarify the blocker and open up options.\n" +
    "- Always speak to the customer's decision-makers, not to end users. Keep the tone practical and grounded, not marketing-led.\n";

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
      console.error("[win-theme-blocker] OpenAI API error", {
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
      console.error("[win-theme-blocker] OpenAI response missing content", { data });
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[win-theme-blocker] Failed to parse OpenAI JSON content", {
        content,
        error: parseError,
      });
      return null;
    }

    const result = parsed as BlockerResult;
    if (
      !result ||
      typeof result.analysis !== "string" ||
      !Array.isArray(result.suggestions) ||
      !Array.isArray(result.questions)
    ) {
      console.error("[win-theme-blocker] Parsed JSON does not match expected shape", {
        parsed: result,
      });
      return null;
    }

    return result;
  } catch (error) {
    console.error("[win-theme-blocker] Error calling OpenAI", { error });
    return null;
  }
}

function buildPlaceholderBlockerResult(blockerDescription: string): BlockerResult {
  const trimmed = blockerDescription.trim();
  const analysis =
    trimmed.length > 0
      ? `Working hypothesis about this blocker based on your description: ${trimmed}. Treat this as a starting point for structured thinking until the blocker assistant is fully available.`
      : "Working hypothesis about this blocker based on your description. Treat this as a starting point for structured thinking until the blocker assistant is fully available.";

  const suggestions: string[] = [
    "Clarify with the customer's decision-makers what success looks like for this opportunity in concrete, measurable terms.",
    "Map the stakeholder groups involved in the decision and test whether the blocker is driven by procurement rules, individual preferences, or organisational risk appetite.",
    "Identify two or three comparable projects or references that speak directly to the concern behind this blocker and bring them into upcoming conversations.",
    "Reframe the issue in terms of risk and assurance, and prepare a short, evidence-backed narrative that shows how your approach reduces that risk.",
  ];

  const questions: string[] = [
    "Which specific stakeholder owns this blocker and what outcome are they trying to protect?",
    "What evidence would most credibly change their view (for example data, case studies, site visits, or third-party endorsements)?",
    "How is this blocker being discussed internally on the client side – is it written into formal criteria or mainly informal concern?",
    "If this blocker cannot be removed entirely, what compromise position would still make the opportunity worth pursuing for both sides?",
  ];

  return {
    analysis,
    suggestions,
    questions,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as BlockerRequestBody | null;

  if (
    !body ||
    !body.opportunity ||
    !body.opportunity.id ||
    !body.blocker_description ||
    !body.blocker_description.trim()
  ) {
    return res.status(400).json({
      error: "Missing required fields. Provide opportunity and blocker_description.",
    });
  }

  const { opportunity, blocker_description: blockerDescription } = body;
  const history = Array.isArray(body.history) ? body.history : [];

  let companiesHouse: unknown = null;
  if (opportunity.company_number) {
    try {
      companiesHouse = await fetchCompaniesHouseProfile(opportunity.company_number);
    } catch (error) {
      console.error(
        "[win-theme-blocker] Failed to fetch Companies House profile",
        {
          companyNumber: opportunity.company_number,
          error,
        },
      );
    }
  }

  let braveContext: BraveContext | null = null;
  try {
    braveContext = await fetchBraveContext(opportunity, companiesHouse);
  } catch (error) {
    console.error(
      "[win-theme-blocker] Unexpected error when fetching Brave context",
      { error },
    );
  }

  let result: BlockerResult | null = null;
  try {
    result = await generateBlockerWithLLM({
      opportunity,
      blockerDescription,
      history,
      companiesHouse,
      braveContext,
    });
  } catch (error) {
    console.error(
      "[win-theme-blocker] Unexpected error during LLM blocker generation",
      { error },
    );
  }

  const finalResult = result ?? buildPlaceholderBlockerResult(blockerDescription);

  return res.status(200).json({
    analysis: finalResult.analysis,
    suggestions: finalResult.suggestions,
    questions: finalResult.questions,
  });
}