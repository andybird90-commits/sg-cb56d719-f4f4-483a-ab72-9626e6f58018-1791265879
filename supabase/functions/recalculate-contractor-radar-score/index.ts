import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface RadarScoreRequest {
  contractor_id: string
}

interface ScoreComponents {
  fit_geo: number
  fit_size: number
  fit_specialism: number
  relationship_heat: number
  performance: number
  data_completeness: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const { contractor_id }: RadarScoreRequest = await req.json()

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

    if (contractorError || !contractor) {
      return new Response(
        JSON.stringify({ error: 'Contractor not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch capabilities
    const { data: capabilities } = await supabaseClient
      .from('me_contractor_capabilities')
      .select('capability')
      .eq('contractor_id', contractor_id)

    // Fetch relationships
    const { data: relationships } = await supabaseClient
      .from('me_contractor_relationships')
      .select('*')
      .eq('contractor_id', contractor_id)
      .order('interaction_date', { ascending: false })

    // Calculate score components
    const scores: ScoreComponents = {
      fit_geo: calculateGeoFit(contractor.region),
      fit_size: calculateSizeFit(contractor.employees, contractor.turnover_gbp),
      fit_specialism: calculateSpecialismFit(capabilities || []),
      relationship_heat: calculateRelationshipHeat(relationships || []),
      performance: calculatePerformance(relationships || []),
      data_completeness: calculateDataCompleteness(contractor, capabilities || [])
    }

    // Calculate weighted radar score
    const radar_score = Math.round(
      scores.fit_geo * 0.25 +
      scores.fit_size * 0.15 +
      scores.fit_specialism * 0.25 +
      scores.relationship_heat * 0.15 +
      scores.performance * 0.15 +
      scores.data_completeness * 0.05
    )

    // Upsert radar score
    const { error: upsertError } = await supabaseClient
      .from('me_contractor_radar_scores')
      .upsert({
        contractor_id,
        radar_score,
        ...scores,
        calculated_at: new Date().toISOString()
      })

    if (upsertError) {
      throw upsertError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        contractor_id,
        radar_score,
        components: scores
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

// Scoring functions
function calculateGeoFit(region: string | null): number {
  // Priority regions for RD Group
  const priorityRegions = ['London', 'South East', 'East of England', 'South West']
  if (!region) return 30
  if (priorityRegions.includes(region)) return 100
  if (['East Midlands', 'West Midlands', 'North West'].includes(region)) return 70
  return 50
}

function calculateSizeFit(employees: number | null, turnover: number | null): number {
  // Sweet spot: 10-100 employees, £2M-£20M turnover
  let score = 50
  
  if (employees) {
    if (employees >= 10 && employees <= 100) score += 25
    else if (employees > 100 && employees <= 250) score += 15
    else if (employees < 10) score += 10
  }
  
  if (turnover) {
    if (turnover >= 2000000 && turnover <= 20000000) score += 25
    else if (turnover > 20000000 && turnover <= 50000000) score += 15
    else if (turnover < 2000000) score += 10
  }
  
  return Math.min(score, 100)
}

function calculateSpecialismFit(capabilities: any[]): number {
  // High-value capabilities
  const highValueCaps = [
    'HVAC', 'Electrical', 'BMS', 'Fire Safety', 'Data Centre',
    'Critical Systems', 'Renewable Energy', 'EV Charging'
  ]
  
  const capNames = capabilities.map(c => c.capability)
  const highValueCount = capNames.filter(c => highValueCaps.includes(c)).length
  
  if (highValueCount >= 3) return 100
  if (highValueCount === 2) return 80
  if (highValueCount === 1) return 60
  if (capNames.length > 0) return 40
  return 20
}

function calculateRelationshipHeat(relationships: any[]): number {
  if (relationships.length === 0) return 20
  
  const recentInteractions = relationships.filter(r => {
    const daysSince = (Date.now() - new Date(r.interaction_date).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince <= 90
  })
  
  const positiveInteractions = relationships.filter(r => 
    ['positive', 'very_positive'].includes(r.sentiment)
  ).length
  
  let score = 20
  score += Math.min(recentInteractions.length * 15, 50)
  score += Math.min(positiveInteractions * 10, 30)
  
  return Math.min(score, 100)
}

function calculatePerformance(relationships: any[]): number {
  if (relationships.length === 0) return 50
  
  const performanceRatings = relationships
    .filter(r => r.performance_rating !== null)
    .map(r => r.performance_rating)
  
  if (performanceRatings.length === 0) return 50
  
  const avgRating = performanceRatings.reduce((a, b) => a + b, 0) / performanceRatings.length
  return avgRating * 20 // Convert 1-5 scale to 20-100
}

function calculateDataCompleteness(contractor: any, capabilities: any[]): number {
  let completedFields = 0
  let totalFields = 10
  
  if (contractor.name) completedFields++
  if (contractor.region) completedFields++
  if (contractor.postcode) completedFields++
  if (contractor.sic_code) completedFields++
  if (contractor.employees) completedFields++
  if (contractor.turnover_gbp) completedFields++
  if (contractor.website) completedFields++
  if (contractor.companies_house_number) completedFields++
  if (capabilities.length > 0) completedFields++
  if (contractor.notes) completedFields++
  
  return (completedFields / totalFields) * 100
}