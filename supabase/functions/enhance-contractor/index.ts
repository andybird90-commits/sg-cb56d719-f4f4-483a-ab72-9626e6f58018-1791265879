import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { contractorId } = await req.json();

    if (!contractorId) {
      throw new Error("contractorId is required");
    }

    // 1. Fetch current contractor data
    const { data: contractor, error: fetchError } = await supabaseClient
      .from("me_contractors")
      .select("*")
      .eq("id", contractorId)
      .single();

    if (fetchError || !contractor) {
      throw new Error("Contractor not found");
    }

    const companyName = contractor.name;
    const companyNumber = contractor.company_number;

    // 2. Fetch Companies House Data
    let companiesHouseData = null;
    if (companyNumber) {
      try {
        const chApiKey = Deno.env.get("COMPANIES_HOUSE_API_KEY");
        if (chApiKey) {
          const chResponse = await fetch(
            `https://api.company-information.service.gov.uk/company/${companyNumber}`,
            {
              headers: { Authorization: `Basic ${btoa(chApiKey + ":")}` },
            }
          );
          
          if (chResponse.ok) {
            companiesHouseData = await chResponse.json();
          }
        }
      } catch (e) {
        console.error("Companies House fetch failed:", e);
      }
    }

    // 3. Search Data
    let searchResults = [];
    try {
      const braveKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
      if (braveKey) {
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
        }
      }
    } catch (e) {
      console.error("Search failed:", e);
    }

    // 4. AI Analysis
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      throw new Error("OpenAI API Key not configured");
    }

    const systemPrompt = "You are an expert UK construction industry data analyst.";
    
    // Construct prompt safely
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
- employees: (number) Estimated employee count
- turnover_gbp: (number) Estimated annual turnover
- notes: (string) A brief 2-sentence summary
- confidence: (number) 0-100 score of data quality`;

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
      throw new Error("OpenAI error");
    }

    const aiData = await aiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 5. Update Database - STRICTLY EXISTING COLUMNS ONLY
    // We explicitly define the interface of what we are updating to match the schema
    const updates: Record<string, any> = {
      last_enhanced_at: new Date().toISOString(),
      enhancement_confidence: result.confidence || 50,
      companies_house_raw: companiesHouseData || contractor.companies_house_raw || {}
    };

    if (result.region) updates.region = result.region;
    if (result.postcode) updates.postcode = result.postcode;
    if (result.address) updates.address = result.address;
    if (result.sic_code) updates.sic_code = result.sic_code;
    if (result.employees) updates.employees = result.employees;
    if (result.turnover_gbp) updates.turnover_gbp = result.turnover_gbp;
    
    if (result.notes) {
      const newNote = `[AI Enhanced]: ${result.notes}`;
      updates.notes = contractor.notes ? `${contractor.notes}

${newNote}` : newNote;
    }

    // DEBUG: Log updates to ensure no invalid columns
    console.log("Updating contractor with:", JSON.stringify(updates));

    const { error: updateError } = await supabaseClient
      .from("me_contractors")
      .update(updates)
      .eq("id", contractorId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Update failed: ${updateError.message}`);
    }

    // 6. Trigger Radar Score
    await supabaseClient.functions.invoke('recalculate-contractor-radar-score', {
        body: { contractorId }
    });

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});