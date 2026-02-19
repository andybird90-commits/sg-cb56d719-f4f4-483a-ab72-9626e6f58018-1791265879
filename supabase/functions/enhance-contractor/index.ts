import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { contractor_id } = await req.json()

    if (!contractor_id) {
      return new Response(
        JSON.stringify({ error: 'contractor_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch contractor data
    const { data: contractor, error: contractorError } = await supabaseClient
      .from('me_contractors')
      .select('*')
      .eq('id', contractor_id)
      .single()

    if (contractorError) throw contractorError

    // TODO: Add actual AI enrichment logic here
    // For now, just update the enhancement metadata
    
    // Calculate a basic confidence score based on data completeness
    let confidence = 50
    if (contractor.email) confidence += 10
    if (contractor.phone) confidence += 10
    if (contractor.website_clean) confidence += 10
    if (contractor.region) confidence += 10
    if (contractor.postcode) confidence += 10

    // Update the contractor with enhancement metadata
    const { error: updateError } = await supabaseClient
      .from('me_contractors')
      .update({
        last_enhanced_at: new Date().toISOString(),
        enhancement_confidence: confidence,
        updated_at: new Date().toISOString()
      })
      .eq('id', contractor_id)

    if (updateError) throw updateError

    // Recalculate radar score after enhancement
    const { error: recalcError } = await supabaseClient.functions.invoke(
      'recalculate-contractor-radar-score',
      {
        body: { contractor_id }
      }
    )

    if (recalcError) {
      console.error('Failed to recalculate radar score:', recalcError)
      // Don't fail the whole operation if radar calc fails
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        contractor_id,
        confidence,
        message: 'Contractor enhanced successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Enhancement error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})