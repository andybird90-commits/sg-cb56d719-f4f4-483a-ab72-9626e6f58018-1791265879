import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { contractorId } = await req.json();
    console.log("[Enhance] Request received for contractorId:", contractorId);

    if (!contractorId) {
      throw new Error("contractorId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get contractor details
    const { data: contractor, error: fetchError } = await supabase
      .from("me_contractors")
      .select("*")
      .eq("id", contractorId)
      .single();

    if (fetchError || !contractor) {
      console.error("[Enhance] Contractor fetch error:", fetchError);
      throw new Error(`Contractor not found: ${fetchError?.message}`);
    }

    console.log("[Enhance] Contractor fetched:", contractor.name);

    // Check for API keys
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    console.log("[Enhance] OpenAI API Key available:", !!openAiKey);
    console.log("[Enhance] OpenAI API Key (first 10 chars):", openAiKey?.substring(0, 10));

    let enhancedData: any = {};

    if (openAiKey) {
      try {
        console.log("[Enhance] Calling OpenAI API...");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o", 
            messages: [
              {
                role: "system",
                content: "You are a data enrichment assistant. Return a JSON object with fields: region, postcode, address, sic_code, employees (number or range), turnover_gbp (number or range with currency), notes (summary). Estimate if exact data unavailable."
              },
              {
                role: "user",
                content: `Enhance data for UK contractor: ${contractor.name} in ${contractor.region || "UK"}. Current info: ${JSON.stringify(contractor)}`
              }
            ],
            response_format: { type: "json_object" }
          })
        });
        
        const aiData = await response.json();
        console.log("[Enhance] OpenAI Response Status:", response.status);
        console.log("[Enhance] OpenAI Response:", JSON.stringify(aiData));
        
        if (aiData.choices && aiData.choices[0]) {
          const content = aiData.choices[0].message.content;
          console.log("[Enhance] AI Content:", content);
          enhancedData = JSON.parse(content);
          console.log("[Enhance] Parsed AI Data:", JSON.stringify(enhancedData));
        } else {
          console.error("[Enhance] No choices in OpenAI response");
          enhancedData = { notes: "AI Enhancement failed - no response", enhancement_confidence: 0 };
        }
      } catch (err) {
        console.error("[Enhance] OpenAI API Error:", err);
        enhancedData = { notes: `AI Enhancement failed: ${err.message}`, enhancement_confidence: 0 };
      }
    } else {
      console.log("[Enhance] No OpenAI API Key, using mock data");
      enhancedData = {
        notes: "AI Enhancement skipped (No API Key).",
        enhancement_confidence: 0
      };
    }

    // Helper to parse numeric fields safely
    const parseNumeric = (value: any): number | null => {
      if (!value) return null;
      const str = String(value).toLowerCase();
      // Remove currency and commas
      const clean = str.replace(/[£$,]/g, "");
      
      // Handle K/M/B suffixes
      let multiplier = 1;
      if (clean.includes("k")) multiplier = 1000;
      else if (clean.includes("m")) multiplier = 1000000;
      else if (clean.includes("b")) multiplier = 1000000000;
      
      // Remove letters and split ranges (e.g. "10-50" -> 10)
      const numStr = clean.replace(/[a-z]/g, "").trim();
      const parts = numStr.split("-");
      const num = parseFloat(parts[0]);
      
      if (isNaN(num)) return null;
      return Math.round(num * multiplier);
    };

    const updates: any = {
      last_enhanced_at: new Date().toISOString(),
      enhancement_confidence: enhancedData.confidence || 85,
    };

    // Map AI fields to DB columns safely
    if (enhancedData.region) updates.region = enhancedData.region;
    if (enhancedData.postcode) updates.postcode = enhancedData.postcode;
    if (enhancedData.address) updates.address = enhancedData.address;
    if (enhancedData.sic_code) updates.sic_code = enhancedData.sic_code;
    if (enhancedData.notes) updates.notes = enhancedData.notes;
    
    // Numeric fields with parsing
    const employees = parseNumeric(enhancedData.employees);
    if (employees !== null) updates.employees = employees;

    const turnover = parseNumeric(enhancedData.turnover_gbp || enhancedData.turnover);
    if (turnover !== null) updates.turnover_gbp = turnover;

    console.log("[Enhance] Final updates to send to DB:", JSON.stringify(updates));

    // Update DB
    const { error: updateError } = await supabase
      .from("me_contractors")
      .update(updates)
      .eq("id", contractorId);

    if (updateError) {
      console.error("[Enhance] DB Update error:", updateError);
      throw new Error(`DB Update failed: ${updateError.message}`);
    }

    console.log("[Enhance] DB updated successfully");

    // Try to trigger score recalculation (ignore error if RPC missing)
    try {
      await supabase.rpc('recalculate_radar_score', { contractor_id: contractorId });
      console.log("[Enhance] Radar score recalculated");
    } catch (e) {
      console.warn("[Enhance] Recalculate score failed:", e);
    }

    return new Response(
      JSON.stringify({ success: true, updates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Enhance] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});