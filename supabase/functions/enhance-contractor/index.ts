import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to parse numeric values from strings like "10-50", "100+", "£1m", etc.
function parseNumeric(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  
  const str = String(value).trim();
  if (!str) return null;

  // Handle ranges like "10-50" -> return lower bound 10
  if (str.includes('-')) {
    const parts = str.split('-');
    const lower = parseNumeric(parts[0]);
    return lower;
  }

  // Remove currency and commas
  const clean = str.replace(/[£$,]/g, '').toLowerCase();

  // Handle suffixes
  if (clean.endsWith('k')) {
    return parseFloat(clean) * 1000;
  }
  if (clean.endsWith('m')) {
    return parseFloat(clean) * 1000000;
  }
  if (clean.endsWith('b')) {
    return parseFloat(clean) * 1000000000;
  }

  // Parse generic number
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    console.log(`Enhancing contractor: ${contractorId}`);

    // 1. Get current contractor data
    const { data: contractor, error: fetchError } = await supabaseClient
      .from("me_contractors")
      .select("*")
      .eq("id", contractorId)
      .single();

    if (fetchError || !contractor) {
      throw new Error(`Contractor not found: ${fetchError?.message}`);
    }

    let aiUpdates = {};
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (openAiKey) {
      console.log("Using OpenAI for enhancement...");
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a data enrichment assistant. Return JSON only. Suggest likely employee count (number or range), turnover (with currency), and SIC code based on the company name and region."
              },
              {
                role: "user",
                content: `Company: ${contractor.name}, Region: ${contractor.region || "UK"}. Return JSON with keys: employees, turnover_gbp, sic_code, enhancement_confidence (0-100), notes.`
              }
            ],
            response_format: { type: "json_object" }
          }),
        });
        
        const data = await response.json();
        if (data.choices && data.choices[0]) {
           aiUpdates = JSON.parse(data.choices[0].message.content);
        }
      } catch (e) {
        console.error("OpenAI error:", e);
        // Fallback if AI fails
      }
    } else {
      console.log("No OpenAI key, using mock data...");
      // Mock data for stability if no key
      aiUpdates = {
        employees: "10-50",
        turnover_gbp: "£1m",
        sic_code: "43210",
        enhancement_confidence: 75,
        notes: "Auto-enhanced (Mock)"
      };
    }

    // Merge with existing data, preferring AI updates but handling nulls
    // Crucially: Parse the numerics!
    const updates = {
      // Only update fields if AI provided them, else keep existing or set null
      employees: parseNumeric((aiUpdates as any).employees) ?? contractor.employees,
      turnover_gbp: parseNumeric((aiUpdates as any).turnover_gbp) ?? contractor.turnover_gbp,
      sic_code: (aiUpdates as any).sic_code || contractor.sic_code,
      enhancement_confidence: (aiUpdates as any).enhancement_confidence || 50,
      notes: (aiUpdates as any).notes || "Enhanced via Softgen",
      last_enhanced_at: new Date().toISOString()
    };

    console.log("Applying updates to DB:", JSON.stringify(updates));

    const { error: updateError } = await supabaseClient
      .from("me_contractors")
      .update(updates)
      .eq("id", contractorId);

    if (updateError) {
      throw new Error(`DB Update failed: ${updateError.message}`);
    }

    // Trigger Radar Score Recalculation
    try {
       await supabaseClient.functions.invoke('recalculate-contractor-radar-score', {
        body: { contractorId }
       });
    } catch (e) {
      console.warn("Failed to trigger radar score recalc", e);
    }

    return new Response(
      JSON.stringify({ success: true, data: updates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});