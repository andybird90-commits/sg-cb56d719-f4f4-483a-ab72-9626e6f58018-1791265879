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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse Input
    let body;
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("JSON Parse Error:", e);
      throw new Error("Invalid JSON body");
    }

    const contractorId = body.contractorId;

    if (!contractorId) {
      console.error("Missing contractorId in body:", body);
      throw new Error("contractorId is required");
    }

    console.log(`Processing enhancement for: ${contractorId}`);

    // 1. Fetch Contractor Data
    const { data: contractor, error: fetchError } = await supabaseClient
      .from("me_contractors")
      .select("*")
      .eq("id", contractorId)
      .single();

    if (fetchError || !contractor) {
      console.error("Fetch Error:", fetchError);
      throw new Error("Contractor not found in database");
    }

    const companyName = contractor.name;
    const companyNumber = contractor.company_number;

    // 2. Gather External Data (Companies House)
    let companiesHouseData = null;
    const chApiKey = Deno.env.get("COMPANIES_HOUSE_API_KEY");
    
    if (companyNumber && chApiKey) {
      try {
        console.log(`Fetching CH data for ${companyNumber}...`);
        const chResponse = await fetch(
          `https://api.company-information.service.gov.uk/company/${companyNumber}`,
          { 
            headers: { 
              Authorization: `Basic ${btoa(chApiKey + ":")}` 
            } 
          }
        );
        if (chResponse.ok) {
          companiesHouseData = await chResponse.json();
          console.log("CH data fetched successfully");
        } else {
          console.warn(`CH fetch failed: ${chResponse.status}`);
        }
      } catch (e) {
        console.error("CH Fetch Exception:", e);
      }
    }

    // 3. AI Analysis
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      throw new Error("OPENAI_API_KEY missing");
    }

    const systemPrompt = "You are an expert UK construction industry data analyst.";
    
    // Construct prompt safely
    const existingRegion = contractor.region || "Unknown";
    const existingSic = contractor.sic_code || "Unknown";
    const chDataStr = companiesHouseData ? JSON.stringify(companiesHouseData) : "{}";
    
    const userPrompt = `Analyze this contractor: ${companyName}.
Region: ${existingRegion}
SIC: ${existingSic}
CH Data: ${chDataStr}

Return JSON with these fields ONLY:
- region: (string) Best estimated UK region
- postcode: (string) Registered postcode
- address: (string) Full registered address
- sic_code: (string) Primary SIC code
- employees: (string) Estimated employee count (e.g. '10-50')
- turnover_gbp: (string) Estimated annual turnover (e.g. '£1M-£5M')
- notes: (string) A brief 2-sentence summary
- confidence: (number) 0-100 score of data quality`;

    console.log("Sending request to OpenAI...");
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
      const errorText = await aiResponse.text();
      console.error("OpenAI Error:", errorText);
      throw new Error(`OpenAI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    
    let result;
    try {
        result = JSON.parse(aiContent);
        console.log("AI Analysis complete. Confidence:", result.confidence);
    } catch (e) {
        console.error("AI JSON Parse Error:", aiContent);
        throw new Error("Failed to parse OpenAI JSON response");
    }

    // 4. Update Database
    const updates: any = {
      last_enhanced_at: new Date().toISOString(),
      enhancement_confidence: result.confidence || 50
    };
    
    // Map fields
    if (companiesHouseData) updates.companies_house_raw = companiesHouseData;
    if (result.region) updates.region = result.region;
    if (result.postcode) updates.postcode = result.postcode;
    if (result.address) updates.address = result.address;
    if (result.sic_code) updates.sic_code = result.sic_code;
    // Ensure these are strings
    if (result.employees) updates.employees = String(result.employees);
    if (result.turnover_gbp) updates.turnover_gbp = String(result.turnover_gbp);
    
    // Handle notes appending safely
    if (result.notes) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const newNoteEntry = `[AI ${today}]: ${result.notes}`;
      const oldNotes = contractor.notes || "";
      
      if (oldNotes) {
        updates.notes = oldNotes + "

" + newNoteEntry;
      } else {
        updates.notes = newNoteEntry;
      }
    }

    console.log("Updating database with:", Object.keys(updates));

    const { error: updateError } = await supabaseClient
      .from("me_contractors")
      .update(updates)
      .eq("id", contractorId);

    if (updateError) {
      console.error("DB Update Failed:", updateError);
      throw new Error(`DB Update failed: ${updateError.message}`);
    }

    // 5. Trigger Radar Score Recalculation
    try {
      console.log("Triggering radar score recalculation...");
      await supabaseClient.functions.invoke('recalculate-contractor-radar-score', {
          body: { contractorId }
      });
    } catch (e) {
      console.warn("Radar Score trigger warning (non-fatal):", e);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});