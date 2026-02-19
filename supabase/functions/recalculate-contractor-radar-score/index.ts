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

    // Fetch contractor
    const { data: contractor, error: contractorError } = await supabaseClient
      .from('me_contractors')
      .select('*')
      .eq('id', contractor_id)
      .single()

    if (contractorError) throw contractorError

    // Fetch relationships
    const { data: relationships, error: relError } = await supabaseClient
      .from('me_contractor_relationships')
      .select('*')
      .eq('contractor_id', contractor_id)

    if (relError) throw relError

    // Fetch capabilities
    const { data: capabilities, error: capError } = await supabaseClient
      .from('me_contractor_capabilities')
      .select('*')
      .eq('contractor_id', contractor_id)

    if (capError) throw capError

    // Calculate scores
    const fitGeo = calculateFitGeo(contractor.region)
    const fitSize = calculateFitSize(contractor.employees, contractor.turnover_gbp)
    const fitSpecialism = calculateFitSpecialism(capabilities || [])
    const relationshipHeat = calculateRelationshipHeat(relationships || [])
    const performance = calculatePerformance(relationships || [])
    const dataCompleteness = calculateDataCompleteness(contractor, capabilities || [], relationships || [])

    // Weighted radar score
    const radarScore = Math.round(
      fitGeo * 0.25 +
      fitSize * 0.15 +
      fitSpecialism * 0.25 +
      relationshipHeat * 0.15 +
      performance * 0.15 +
      dataCompleteness * 0.05
    )

    // Upsert radar score
    const { error: upsertError } = await supabaseClient
      .from('me_contractor_radar_scores')
      .upsert({
        contractor_id,
        radar_score: radarScore,
        fit_geo: fitGeo,
        fit_size: fitSize,
        fit_specialism: fitSpecialism,
        relationship_heat: relationshipHeat,
        performance: performance,
        data_completeness: dataCompleteness,
        calculated_at: new Date().toISOString()
      }, { onConflict: 'contractor_id' })

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({ 
        success: true, 
        radar_score: radarScore,
        breakdown: {
          fit_geo: fitGeo,
          fit_size: fitSize,
          fit_specialism: fitSpecialism,
          relationship_heat: relationshipHeat,
          performance: performance,
          data_completeness: dataCompleteness
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calculateFitGeo(region: string | null): number {
  const priorityRegions = ['London', 'South East', 'East of England', 'South West']
  if (!region) return 50
  return priorityRegions.includes(region) ? 100 : 70
}

function calculateFitSize(employees: number | null, turnover: number | null): number {
  let score = 50
  if (employees && employees >= 10 && employees <= 100) score += 25
  if (turnover && turnover >= 1000000 && turnover <= 10000000) score += 25
  return Math.min(score, 100)
}

function calculateFitSpecialism(capabilities: any[]): number {
  const priorityTrades = ['Electrical', 'Mechanical', 'HVAC', 'Fire & Security', 'Plumbing']
  if (!capabilities || capabilities.length === 0) return 30
  
  const matches = capabilities.filter(c => 
    priorityTrades.some(pt => c.capability_name?.includes(pt))
  ).length
  
  return Math.min(30 + (matches * 20), 100)
}

function calculateRelationshipHeat(relationships: any[]): number {
  if (!relationships || relationships.length === 0) return 0
  
  const now = new Date()
  const recentInteractions = relationships.filter(r => {
    const interactionDate = new Date(r.interaction_date)
    const daysSince = (now.getTime() - interactionDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince <= 90
  })
  
  const baseScore = Math.min((recentInteractions.length / relationships.length) * 100, 80)
  const hasQualityNotes = relationships.some(r => r.notes && r.notes.length > 50)
  
  return Math.min(baseScore + (hasQualityNotes ? 20 : 0), 100)
}

function calculatePerformance(relationships: any[]): number {
  if (!relationships || relationships.length === 0) return 50
  
  const positiveTypes = ['meeting', 'project_discussion', 'tender_invite']
  const positiveInteractions = relationships.filter(r => 
    positiveTypes.includes(r.interaction_type)
  ).length
  
  return Math.min((positiveInteractions / relationships.length) * 100, 100)
}

function calculateDataCompleteness(contractor: any, capabilities: any[], relationships: any[]): number {
  let completedFields = 0
  const totalFields = 10
  
  if (contractor.name) completedFields++
  if (contractor.region) completedFields++
  if (contractor.postcode) completedFields++
  if (contractor.sic_code) completedFields++
  if (contractor.employees) completedFields++
  if (contractor.turnover_gbp) completedFields++
  if (contractor.notes) completedFields++
  if (capabilities && capabilities.length > 0) completedFields++
  if (relationships && relationships.length > 0) completedFields++
  if (contractor.status) completedFields++
  
  return (completedFields / totalFields) * 100
}