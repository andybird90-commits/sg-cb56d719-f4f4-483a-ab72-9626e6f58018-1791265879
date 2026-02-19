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
    const { contractorId } = await req.json();
    console.log("Enhancing contractor:", contractorId);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: contractor, error: fetchError } = await supabaseClient
      .from("me_contractors")
      .select("*")
      .eq("id", contractorId)
      .single();

    if (fetchError || !contractor) {
      console.error("Error fetching contractor:", fetchError);
      throw new Error("Contractor not found");
    }

    console.log("Contractor data:", contractor);

    let companiesHouseData = null;
    let braveSearchData = null;
    let aiAnalysis = null;

    if (contractor.company_number) {
      try {
        const companiesHouseKey = Deno.env.get("COMPANIES_HOUSE_API_KEY");
        if (companiesHouseKey) {
          console.log("Fetching from Companies House...");
          const chResponse = await fetch(
            `https://api.company-information.service.gov.uk/company/${contractor.company_number}`,
            {
              headers: {
                Authorization: `Basic ${btoa(companiesHouseKey + ":")}`,
              },
            }
          );

          if (chResponse.ok) {
            companiesHouseData = await chResponse.json();
            console.log("Companies House data fetched successfully");
          } else {
            console.log("Companies House API error:", chResponse.status);
          }
        }
      } catch (error) {
        console.error("Companies House API error:", error);
      }
    }

    try {
      const braveApiKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
      if (braveApiKey && contractor.name) {
        console.log("Searching with Brave...");
        const searchQuery = encodeURIComponent(contractor.name + " UK company");
        const braveResponse = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${searchQuery}`,
          {
            headers: {
              "X-Subscription-Token": braveApiKey,
              Accept: "application/json",
            },
          }
        );

        if (braveResponse.ok) {
          braveSearchData = await braveResponse.json();
          console.log("Brave search data fetched successfully");
        } else {
          console.log("Brave API error:", braveResponse.status);
        }
      }
    } catch (error) {
      console.error("Brave Search API error:", error);
    }

    try {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        console.log("Analyzing with OpenAI...");
        
        const promptParts = [];
        promptParts.push("Analyze this contractor data and suggest improvements for missing fields only.");
        promptParts.push("");
        promptParts.push("CURRENT DATA:");
        promptParts.push(JSON.stringify({
          name: contractor.name,
          region: contractor.region,
          postcode: contractor.postcode,
          address: contractor.address,
          sic_code: contractor.sic_code,
          employees: contractor.employees,
          turnover_gbp: contractor.turnover_gbp,
          status: contractor.status,
          notes: contractor.notes,
        }, null, 2));
        
        if (companiesHouseData) {
          promptParts.push("");
          promptParts.push("COMPANIES HOUSE DATA:");
          promptParts.push(JSON.stringify(companiesHouseData, null, 2));
        }
        
        if (braveSearchData && braveSearchData.web && braveSearchData.web.results) {
          promptParts.push("");
          promptParts.push("WEB SEARCH RESULTS:");
          promptParts.push(JSON.stringify(braveSearchData.web.results.slice(0, 3), null, 2));
        }
        
        promptParts.push("");
        promptParts.push("Return JSON with suggested values for null/empty fields only. Include confidence score 0-100.");
        
        const userPrompt = promptParts.join("
");

        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a data enrichment specialist. Return only valid JSON with this exact structure: {region, postcode, address, sic_code, employees, turnover_gbp, notes, confidence}" },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          const content = openaiData.choices[0].message.content;
          console.log("OpenAI response:", content);
          
          try {
            aiAnalysis = JSON.parse(content);
            console.log("AI analysis parsed successfully");
          } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            aiAnalysis = { confidence: 50, notes: "AI analysis completed but response format was invalid" };
          }
        } else {
          console.log("OpenAI API error:", openaiResponse.status);
        }
      }
    } catch (error) {
      console.error("OpenAI API error:", error);
    }

    const updates: Record<string, any> = {
      last_enhanced_at: new Date().toISOString(),
      enhancement_confidence: aiAnalysis?.confidence || 50,
    };

    if (aiAnalysis) {
      if (!contractor.region && aiAnalysis.region) updates.region = aiAnalysis.region;
      if (!contractor.postcode && aiAnalysis.postcode) updates.postcode = aiAnalysis.postcode;
      if (!contractor.address && aiAnalysis.address) updates.address = aiAnalysis.address;
      if (!contractor.sic_code && aiAnalysis.sic_code) updates.sic_code = aiAnalysis.sic_code;
      if (!contractor.employees && aiAnalysis.employees) updates.employees = aiAnalysis.employees;
      if (!contractor.turnover_gbp && aiAnalysis.turnover_gbp) updates.turnover_gbp = aiAnalysis.turnover_gbp;
      if (aiAnalysis.notes) {
        const aiNotesPrefix = "AI Enhancement: ";
        const existingNotes = contractor.notes || "";
        const newNotes = existingNotes ? existingNotes + "

" + aiNotesPrefix + aiAnalysis.notes : aiNotesPrefix + aiAnalysis.notes;
        updates.notes = newNotes;
      }
    }

    if (companiesHouseData) {
      updates.companies_house_raw = companiesHouseData;
    }

    console.log("Applying updates:", updates);

    const { error: updateError } = await supabaseClient
      .from("me_contractors")
      .update(updates)
      .eq("id", contractorId);

    if (updateError) {
      console.error("Error updating contractor:", updateError);
      throw updateError;
    }

    try {
      console.log("Triggering radar score recalculation...");
      const { error: recalcError } = await supabaseClient.functions.invoke(
        "recalculate-contractor-radar-score",
        {
          body: { contractorId },
        }
      );
      if (recalcError) {
        console.error("Error recalculating radar score:", recalcError);
      } else {
        console.log("Radar score recalculated successfully");
      }
    } catch (error) {
      console.error("Error invoking radar score function:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contractor enhanced successfully",
        updates,
        sources: {
          companiesHouse: !!companiesHouseData,
          braveSearch: !!braveSearchData,
          aiAnalysis: !!aiAnalysis,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Enhancement error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});