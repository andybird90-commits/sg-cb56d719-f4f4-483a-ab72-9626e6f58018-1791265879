import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valid M&E SIC codes
const VALID_SIC_CODES = ['43210', '43220', '43290']

// SIC code to capability mapping
const SIC_TO_CAPABILITIES: Record<string, string[]> = {
  '43210': ['Electrical', 'Data & Comms', 'Fire & Security'],
  '43220': ['Plumbing', 'HVAC', 'Mechanical'],
  '43290': ['Mechanical', 'HVAC', 'BMS', 'Lifts & Escalators']
}

Deno.serve(async (req) => {
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

    const { import_ids } = await req.json()

    if (!import_ids || !Array.isArray(import_ids) || import_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'import_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    // Fetch import records
    const { data: importRecords, error: fetchError } = await supabaseClient
      .from('me_contractors_import_raw')
      .select('*')
      .in('id', import_ids)
      .eq('processed', false)

    if (fetchError) throw fetchError

    for (const record of importRecords || []) {
      try {
        // Filter: Only active SME M&E contractors
        if (record.status?.toLowerCase() !== 'active') {
          skipped++
          continue
        }

        if (!VALID_SIC_CODES.includes(record.sic_code)) {
          skipped++
          continue
        }

        // Check if contractor exists
        const { data: existing } = await supabaseClient
          .from('me_contractors')
          .select('id')
          .eq('company_number', record.company_number)
          .maybeSingle()

        const contractorData = {
          name: record.company_name,
          company_number: record.company_number,
          region: record.region,
          postcode: record.postcode,
          address_line_1: record.address_line_1,
          address_line_2: record.address_line_2,
          town_city: record.town_city,
          website: record.website,
          phone: record.phone,
          email: record.email,
          sic_code: record.sic_code,
          employees: record.employees,
          turnover_gbp: record.turnover_gbp,
          status: 'prospect',
          notes: `Imported from CSV on ${new Date().toISOString()}`
        }

        let contractorId: string

        if (existing) {
          // Update existing contractor
          const { error: updateError } = await supabaseClient
            .from('me_contractors')
            .update(contractorData)
            .eq('id', existing.id)

          if (updateError) throw updateError
          contractorId = existing.id
          updated++
        } else {
          // Insert new contractor
          const { data: newContractor, error: insertError } = await supabaseClient
            .from('me_contractors')
            .insert(contractorData)
            .select('id')
            .single()

          if (insertError) throw insertError
          contractorId = newContractor.id
          inserted++
        }

        // Seed capabilities based on SIC code
        const capabilities = SIC_TO_CAPABILITIES[record.sic_code] || []
        for (const capability of capabilities) {
          const { error: capError } = await supabaseClient
            .from('me_contractor_capabilities')
            .upsert({
              contractor_id: contractorId,
              capability_name: capability,
              level: 'core'
            }, {
              onConflict: 'contractor_id,capability_name',
              ignoreDuplicates: true
            })

          if (capError) console.error('Capability insert error:', capError)
        }

        // Seed initial relationship if none exists
        const { data: existingRel } = await supabaseClient
          .from('me_contractor_relationships')
          .select('id')
          .eq('contractor_id', contractorId)
          .maybeSingle()

        if (!existingRel) {
          await supabaseClient
            .from('me_contractor_relationships')
            .insert({
              contractor_id: contractorId,
              interaction_type: 'data_import',
              interaction_date: new Date().toISOString(),
              notes: 'Initial data import from CSV',
              sentiment: 'neutral'
            })
        }

        // Seed initial radar score if none exists
        const { data: existingScore } = await supabaseClient
          .from('me_contractor_radar_scores')
          .select('id')
          .eq('contractor_id', contractorId)
          .maybeSingle()

        if (!existingScore) {
          await supabaseClient
            .from('me_contractor_radar_scores')
            .insert({
              contractor_id: contractorId,
              radar_score: 50,
              fit_geo: 50,
              fit_size: 50,
              fit_specialism: 50,
              relationship_heat: 0,
              performance: 50,
              data_completeness: 60,
              calculated_at: new Date().toISOString()
            })
        }

        // Mark as processed
        await supabaseClient
          .from('me_contractors_import_raw')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', record.id)

      } catch (err: any) {
        errors.push(`Row ${record.company_name}: ${err.message}`)
        skipped++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total: importRecords?.length || 0,
          inserted,
          updated,
          skipped,
          errors
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})