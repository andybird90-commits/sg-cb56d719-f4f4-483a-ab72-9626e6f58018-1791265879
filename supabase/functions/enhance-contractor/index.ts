import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompaniesHouseData {
  company_name?: string;
  company_number?: string;
  company_status?: string;
  registered_office_address?: {
    address_line_1?: string;
    locality?: string;
    postal_code?: string;
    country?: string;
  };
  sic_codes?: string[];
  date_of_creation?: string;
}

interface BraveSearchResult {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  };
}

async function fetchCompaniesHouseData(companyNumber: string): Promise<CompaniesHouseData | null> {
  const apiKey = Deno.env.get("COMPANIES_HOUSE_API_KEY");
  if (!apiKey) {
    console.error("COMPANIES_HOUSE_API_KEY not set");
    return null;
  }

  try {
    const auth = btoa(`${apiKey}:`);
    const response = await fetch(
      `https://api.company-information.service.gov.uk/company/${companyNumber}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Companies House API error:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Companies House data:", error);
    return null;
  }
}

async function searchBrave(query: string): Promise<BraveSearchResult | null> {
  const apiKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
  if (!apiKey) {
    console.error("BRAVE_SEARCH_API_KEY not set");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error("Brave Search API error:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error searching Brave:", error);
    return null;
  }
}

async function enhanceWithOpenAI(
  contractorData: Record<string, unknown>,
  companiesHouseData: CompaniesHouseData | null,
  braveData: BraveSearchResult | null
): Promise<Record<string, unknown> | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("OPENAI_API_KEY not set");
    return null;
  }

  const prompt = `Analyze this contractor data and provide enrichment suggestions:

Contractor Information:
- Name: ${contractorData.company_name || "N/A"}
- Email: ${contractorData.email || "N/A"}
- Phone: ${contractorData.phone || "N/A"}
- Website: ${contractorData.website_clean || "N/A"}
- Region: ${contractorData.region || "N/A"}
- Postcode: ${contractorData.postcode || "N/A"}

${companiesHouseData ? `Companies House Data:
- Company Number: ${companiesHouseData.company_number}
- Status: ${companiesHouseData.company_status}
- Address: ${JSON.stringify(companiesHouseData.registered_office_address)}
- SIC Codes: ${companiesHouseData.sic_codes?.join(", ")}
` : ""}

${braveData?.web?.results?.[0] ? `Web Search Results:
- ${braveData.web.results.slice(0, 3).map((r) => `${r.title}: ${r.description}`).join("\n- ")}
` : ""}

Provide a JSON response with:
{
  "confidence": <number 0-100>,
  "suggested_updates": {
    "email": "<email if found>",
    "phone": "<phone if found>",
    "website_clean": "<website if found>",
    "region": "<region if found>",
    "postcode": "<postcode if found>"
  },
  "notes": "<brief summary of findings>"
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a data enrichment assistant. Analyze contractor information and suggest improvements.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return null;
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { contractor_id } = await req.json();

    if (!contractor_id) {
      return new Response(
        JSON.stringify({ error: "contractor_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Enhancing contractor:", contractor_id);

    const { data: contractor, error: contractorError } = await supabaseClient
      .from("me_contractors")
      .select("*")
      .eq("id", contractor_id)
      .single();

    if (contractorError) {
      console.error("Error fetching contractor:", contractorError);
      throw contractorError;
    }

    console.log("Contractor data:", contractor.company_name);

    let companiesHouseData: CompaniesHouseData | null = null;
    let braveData: BraveSearchResult | null = null;

    if (contractor.company_number) {
      console.log("Fetching Companies House data for:", contractor.company_number);
      companiesHouseData = await fetchCompaniesHouseData(contractor.company_number);
    }

    if (contractor.company_name) {
      console.log("Searching Brave for:", contractor.company_name);
      braveData = await searchBrave(`${contractor.company_name} contractor UK`);
    }

    console.log("Calling OpenAI for analysis...");
    const aiResult = await enhanceWithOpenAI(contractor, companiesHouseData, braveData);

    if (!aiResult) {
      throw new Error("Failed to get AI enhancement results");
    }

    console.log("AI Result:", aiResult);

    const updates: Record<string, unknown> = {
      last_enhanced_at: new Date().toISOString(),
      enhancement_confidence: (aiResult.confidence as number) || 50,
      updated_at: new Date().toISOString(),
    };

    if (aiResult.suggested_updates && typeof aiResult.suggested_updates === "object") {
      const suggested = aiResult.suggested_updates as Record<string, unknown>;
      if (suggested.email && !contractor.email) {
        updates.email = suggested.email;
      }
      if (suggested.phone && !contractor.phone) {
        updates.phone = suggested.phone;
      }
      if (suggested.website_clean && !contractor.website_clean) {
        updates.website_clean = suggested.website_clean;
      }
      if (suggested.region && !contractor.region) {
        updates.region = suggested.region;
      }
      if (suggested.postcode && !contractor.postcode) {
        updates.postcode = suggested.postcode;
      }
    }

    console.log("Applying updates:", updates);

    const { error: updateError } = await supabaseClient
      .from("me_contractors")
      .update(updates)
      .eq("id", contractor_id);

    if (updateError) {
      console.error("Error updating contractor:", updateError);
      throw updateError;
    }

    console.log("Recalculating radar score...");
    const { error: recalcError } = await supabaseClient.functions.invoke(
      "recalculate-contractor-radar-score",
      {
        body: { contractor_id },
      }
    );

    if (recalcError) {
      console.error("Failed to recalculate radar score:", recalcError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        contractor_id,
        confidence: aiResult.confidence,
        updates_applied: Object.keys(updates).length - 3,
        notes: aiResult.notes,
        message: "Contractor enhanced successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Enhancement error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});