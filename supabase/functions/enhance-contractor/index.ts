import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. Parse Input
    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Invalid JSON body");
    }

    const { contractorId } = body;
    console.log(`[Enhance] Started for contractorId: ${contractorId}`);

    if (!contractorId) {
      throw new Error("contractorId is required");
    }

    // 3. Fetch Contractor Data
    const { data: contractor, error: fetchError } = await supabaseClient
      .from("me_contractors")
      .select("*")
      .eq("id", contractorId)
      .single();

    if (fetchError || !contractor) {
      console.error("[Enhance] Contractor not found:", fetchError);
      throw new Error("Contractor not found in database");
    }

    const companyName = contractor.name;
    const companyNumber = contractor.company_number;
    console.log(`[Enhance] Processing: ${companyName} (${companyNumber || "No Number"})`);

    // 4. Gather External Data
    let companiesHouseData = null;
    let searchResults = [];

    // A. Companies House (if configured)
    const chApiKey = Deno.env.get("COMPANIES_HOUSE_API_KEY");
    if (companyNumber && chApiKey) {
      try {
        console.log("[Enhance] Fetching Companies House data...");
        const chResponse = await fetch(
          `https://api.company-information.service.gov.uk/company/${companyNumber}`,
          { headers: { Authorization: `Basic ${btoa(chApiKey + ":")}` } }
        );
        if (chResponse.ok) {
          companiesHouseData = await chResponse.json();
          console.log("[Enhance] CH Data found");
        }
      } catch (e) {
        console.error("[Enhance] CH Fetch failed:", e);
      }
    }

    // B. Brave Search (if configured)
    const braveKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
    if (braveKey) {
      try {
        console.log("[Enhance] Performing Web Search...");
        const searchResponse = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(companyName + " construction uk")}&count=3`,
          {
            headers: {
              "Accept": "application/json",
              "X-Subscription-Token": braveKey
            }
          }
        );
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          searchResults = searchData.web?.results || [];
          console.log(`[Enhance] Search returned ${searchResults.length} results`);
        }
      } catch (e) {
        console.error("[Enhance] Search failed:", e);
      }
    }

    // 5. AI Analysis
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      console.error("[Enhance] OPENAI_API_KEY missing");
      throw new Error("OpenAI API Key not configured on server");
    }

    const systemPrompt = "You are an expert UK construction industry data analyst.";
    const userPrompt = `Analyze this contractor: ${companyName}.
Region: ${contractor.region || "Unknown"}
SIC: ${contractor.sic_code || "Unknown"}
CH Data: ${JSON.stringify(companiesHouseData || {})}
Web: ${JSON.stringify(searchResults)}

Return JSON with these fields ONLY:
- region: (string) Best estimated UK region
- postcode: (string) Registered postcode
- address: (string) Full registered address
- sic_code: (string) Primary SIC code
- employees: (string) Estimated employee count (e.g. "10-50")
- turnover_gbp: (string) Estimated annual turnover (e.g. "£1M-£5M")
- notes: (string) A brief 2-sentence summary
- confidence: (number) 0-100 score of data quality`;

    console.log("[Enhance] Calling OpenAI...");
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[Enhance] OpenAI Error:", errText);
      throw new Error(`OpenAI error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    let result;
    try {
      result = JSON.parse(aiData.choices[0].message.content);
    } catch (e) {
      console.error("[Enhance] Failed to parse AI response");
      throw new Error("Invalid AI response format");
    }
    console.log("[Enhance] AI Analysis complete:", JSON.stringify(result));

    // 6. Update Database
    // Build update object dynamically
    const updates: Record<string, any> = {
      last_enhanced_at: new Date().toISOString(),
      enhancement_confidence: result.confidence || 50
    };
    
    if (companiesHouseData) {
        updates.companies_house_raw = companiesHouseData;
    }

    if (result.region) updates.region = result.region;
    if (result.postcode) updates.postcode = result.postcode;
    if (result.address) updates.address = result.address;
    if (result.sic_code) updates.sic_code = result.sic_code;
    
    // Handle employees and turnover as strings since that's what we asked for
    // Check if table expects numbers or strings. Assuming strings based on flexible schema or we parse.
    // Actually, looking at previous schema, employees/turnover might be text.
    if (result.employees) updates.employees = String(result.employees);
    if (result.turnover_gbp) updates.turnover_gbp = String(result.turnover_gbp);
    
    // Append notes
    if (result.notes) {
      const timestamp = new Date().toLocaleDateString();
      const newNote = `[AI Enhanced ${timestamp}]: ${result.notes}`;
      updates.notes = contractor.notes ? `${contractor.notes}

${newNote}` : newNote;
    }

    const { error: updateError } = await supabaseClient
      .from("me_contractors")
      .update(updates)
      .eq("id", contractorId);

    if (updateError) {
      console.error("[Enhance] DB Update failed:", updateError);
      throw new Error(`DB Update failed: ${updateError.message}`);
    }

    // 7. Trigger Radar Score Recalculation
    console.log("[Enhance] Triggering Radar Score...");
    try {
      await supabaseClient.functions.invoke('recalculate-contractor-radar-score', {
          body: { contractorId }
      });
    } catch (e) {
      console.warn("[Enhance] Radar Score trigger warning (non-fatal):", e);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Enhance] Fatal Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});