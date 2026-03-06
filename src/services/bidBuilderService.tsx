import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

// Local row types for new Bid Builder tables to avoid depending on regenerated Database types

export interface OpportunityBidFileRow {
  id: string;
  opportunity_id: string;
  storage_bucket: string;
  storage_object_path: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  is_bid_builder_input: boolean;
  tags: string[] | null;
  parsed_text: string | null;
  ai_summary: unknown | null;
  uploaded_by_user_id: string;
  uploaded_at: string;
  updated_at: string;
}

export interface MeValueRuleRow {
  id: string;
  name: string;
  sector: string | null;
  building_type: string | null;
  project_status: string | null;
  min_total_build_value: number | null;
  max_total_build_value: number | null;
  me_ratio: number;
  status: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeePercentageRuleRow {
  id: string;
  name: string;
  sector: string | null;
  building_type: string | null;
  project_status: string | null;
  min_me_value: number | null;
  max_me_value: number | null;
  min_total_build_value: number | null;
  max_total_build_value: number | null;
  base_low_pct: number;
  base_target_pct: number;
  base_high_pct: number;
  stages: string[] | null;
  disciplines: string[] | null;
  status: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplexityMultiplierRow {
  id: string;
  code: string;
  label: string;
  applies_to: "complexity" | "condition" | "programme" | string;
  complexity_level: string | null;
  condition: string | null;
  programme_pressure: string | null;
  multiplier: number;
  status: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityEstimateRow {
  id: string;
  opportunity_id: string;
  name: string;
  status: string;
  total_fee: number | null;
  currency: string;
  source: string | null;
  assumptions: string | null;
  calculation_basis: unknown | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityEstimateLineItemRow {
  id: string;
  estimate_id: string;
  sort_order: number;
  description: string;
  quantity: number;
  unit: string | null;
  rate: number | null;
  total: number | null;
  stage: string | null;
  discipline: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityFeeScenarioRow {
  id: string;
  opportunity_id: string;
  name: string;
  scenario_type: string;
  calculation_mode: "me_value" | "total_build" | string;
  total_build_value: number | null;
  me_value: number | null;
  derived_me_value: number | null;
  sector: string | null;
  building_type: string | null;
  project_status: string | null;
  listed_building: boolean | null;
  occupied_site: boolean | null;
  complexity_level: string | null;
  programme_pressure: string | null;
  stages_required: string[] | null;
  disciplines_required: string[] | null;
  base_low_pct: number | null;
  base_target_pct: number | null;
  base_high_pct: number | null;
  fee_low: number | null;
  fee_target: number | null;
  fee_high: number | null;
  selected_fee: number | null;
  selected_fee_label: string | null;
  applied_rule_ids: unknown | null;
  calculation_basis: unknown | null;
  is_active: boolean;
  converted_to_estimate_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export type OpportunityLite = {
  id: string;
  name: string;
  enquiry_number: string | null;
  company_name: string;
};

export type QuickFeeInput = {
  opportunityId: string;
  scenarioName: string;
  totalBuildValue?: number | null;
  meValue?: number | null;
  sector?: string | null;
  buildingType?: string | null;
  projectStatus?: string | null;
  listedBuilding?: boolean | null;
  occupiedSite?: boolean | null;
  complexityLevel?: string | null;
  programmePressure?: string | null;
  stagesRequired?: string[];
  disciplinesRequired?: string[];
};

export type QuickFeeResult = {
  calculationMode: "me_value" | "total_build";
  usedMeValue: number;
  derivedMeValue: number | null;
  baseLowPct: number;
  baseTargetPct: number;
  baseHighPct: number;
  appliedMultipliers: {
    code: string;
    label: string;
    multiplier: number;
    applies_to: string;
  }[];
  overallMultiplier: number;
  feeLow: number;
  feeTarget: number;
  feeHigh: number;
  assumptions: string[];
  basis: Record<string, unknown>;
};

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

// Use an untyped Supabase handle inside this service to avoid deep generic instantiation issues
const sb: any = supabase;

export const bidBuilderService = {
  async listOpportunities(search?: string): Promise<OpportunityLite[]> {
    let query = sb
      .from("opportunities")
      .select(
        `
        id,
        name,
        enquiry_number,
        companies:companies!opportunities_company_id_fkey (
          name
        )
      `
      )
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (search && search.trim()) {
      query = query.ilike("name", `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to load opportunities for Bid Builder", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id as string,
      name: row.name as string,
      enquiry_number: (row.enquiry_number as string) || null,
      company_name: row.companies?.name || "Unknown client",
    }));
  },

  async fetchBidFiles(
    opportunityId: string
  ): Promise<OpportunityBidFileRow[]> {
    const { data, error } = await sb
      .from("opportunity_bid_files")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Failed to load bid files", error);
      return [];
    }

    return (data || []) as OpportunityBidFileRow[];
  },

  async uploadBidFiles(
    opportunityId: string,
    userId: string,
    files: File[],
    options?: { markAsInput?: boolean }
  ): Promise<void> {
    if (!files.length) return;

    const markAsInput = options?.markAsInput ?? true;
    const bucket = "opportunity-bid-files";

    const rowsToInsert: Partial<OpportunityBidFileRow>[] = [];

    for (const file of files) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const path = `opportunity/${opportunityId}/${timestamp}-${file.name}`;

      const { error: uploadError } = await sb.storage
        .from(bucket)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        console.error("Failed to upload file to storage", {
          file: file.name,
          uploadError,
        });
        continue;
      }

      rowsToInsert.push({
        opportunity_id: opportunityId,
        storage_bucket: bucket,
        storage_object_path: path,
        filename: file.name,
        content_type: file.type || null,
        size_bytes: file.size,
        is_bid_builder_input: markAsInput,
        uploaded_by_user_id: userId,
      } as Partial<OpportunityBidFileRow>);
    }

    if (rowsToInsert.length === 0) return;

    const { error: insertError } = await sb
      .from("opportunity_bid_files")
      .insert(rowsToInsert as any[]);

    if (insertError) {
      console.error("Failed to insert bid file metadata", insertError);
    }
  },

  async setBidFileInputFlag(
    fileId: string,
    isInput: boolean
  ): Promise<void> {
    const { error } = await sb
      .from("opportunity_bid_files")
      .update({
        is_bid_builder_input: isInput,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId);

    if (error) {
      console.error("Failed to update bid file input flag", error);
      throw error;
    }
  },

  async calculateQuickFee(input: QuickFeeInput): Promise<QuickFeeResult> {
    const assumptions: string[] = [];
    const basis: Record<string, unknown> = {};

    const totalBuildValue = safeNumber(input.totalBuildValue) ?? null;
    let meValue = safeNumber(input.meValue);
    let derivedMeValue: number | null = null;

    let calculationMode: "me_value" | "total_build" = "me_value";
    if (!meValue && totalBuildValue) {
      calculationMode = "total_build";
    }

    if (!meValue && totalBuildValue) {
      const { data: rawRules, error: meRulesError } = await sb
        .from("me_value_rules")
        .select("*")
        .eq("status", "active");

      if (meRulesError) {
        console.error("Failed to load M&E value rules", meRulesError);
      }

      const rules = (rawRules || []) as MeValueRuleRow[];

      const matchingRules = rules.filter((rule) => {
        if (rule.sector && input.sector && rule.sector !== input.sector) {
          return false;
        }
        if (
          rule.building_type &&
          input.buildingType &&
          rule.building_type !== input.buildingType
        ) {
          return false;
        }
        if (
          rule.project_status &&
          input.projectStatus &&
          rule.project_status !== input.projectStatus
        ) {
          return false;
        }
        if (
          rule.min_total_build_value !== null &&
          totalBuildValue < Number(rule.min_total_build_value)
        ) {
          return false;
        }
        if (
          rule.max_total_build_value !== null &&
          totalBuildValue > Number(rule.max_total_build_value)
        ) {
          return false;
        }
        return true;
      });

      const chosenRule =
        matchingRules[0] ?? (rules.length > 0 ? rules[0] : null);

      if (chosenRule) {
        const ratio = Number(chosenRule.me_ratio);
        derivedMeValue = totalBuildValue * ratio;
        meValue = derivedMeValue;
        assumptions.push(
          "M&E value has been inferred from total build value using admin-managed rules."
        );
        basis["me_value_rule"] = chosenRule;
      } else {
        const fallbackRatio = 0.2;
        derivedMeValue = totalBuildValue * fallbackRatio;
        meValue = derivedMeValue;
        assumptions.push(
          "No matching M&E value rule found; assumed M&E value at 20% of total build value."
        );
        basis["me_value_rule_fallback_ratio"] = fallbackRatio;
      }
    }

    const usedMeValue = meValue ?? 0;
    if (!usedMeValue) {
      assumptions.push(
        "No valid M&E or total build value provided; percentages are shown without fee amounts."
      );
    }

    const { data: rawFeeRules, error: feeRulesError } = await sb
      .from("fee_percentage_rules")
      .select("*")
      .eq("status", "active");

    if (feeRulesError) {
      console.error("Failed to load fee percentage rules", feeRulesError);
    }

    const feeRules = (rawFeeRules || []) as FeePercentageRuleRow[];

    const matchingFeeRules = feeRules.filter((rule) => {
      if (rule.sector && input.sector && rule.sector !== input.sector) {
        return false;
      }
      if (
        rule.building_type &&
        input.buildingType &&
        rule.building_type !== input.buildingType
      ) {
        return false;
      }
      if (
        rule.project_status &&
        input.projectStatus &&
        rule.project_status !== input.projectStatus
      ) {
        return false;
      }

      const valueForBand =
        calculationMode === "me_value"
          ? usedMeValue
          : totalBuildValue ?? usedMeValue;

      if (
        rule.min_me_value !== null &&
        calculationMode === "me_value" &&
        usedMeValue &&
        usedMeValue < Number(rule.min_me_value)
      ) {
        return false;
      }
      if (
        rule.max_me_value !== null &&
        calculationMode === "me_value" &&
        usedMeValue &&
        usedMeValue > Number(rule.max_me_value)
      ) {
        return false;
      }
      if (
        rule.min_total_build_value !== null &&
        calculationMode === "total_build" &&
        valueForBand &&
        valueForBand < Number(rule.min_total_build_value)
      ) {
        return false;
      }
      if (
        rule.max_total_build_value !== null &&
        calculationMode === "total_build" &&
        valueForBand &&
        valueForBand > Number(rule.max_total_build_value)
      ) {
        return false;
      }

      return true;
    });

    const chosenFeeRule =
      matchingFeeRules[0] ?? (feeRules.length > 0 ? feeRules[0] : null);

    let baseLowPct = 4;
    let baseTargetPct = 5;
    let baseHighPct = 6;

    if (chosenFeeRule) {
      baseLowPct = Number(chosenFeeRule.base_low_pct);
      baseTargetPct = Number(chosenFeeRule.base_target_pct);
      baseHighPct = Number(chosenFeeRule.base_high_pct);
      basis["fee_percentage_rule"] = chosenFeeRule;
    } else {
      assumptions.push(
        "No matching fee percentage rule found; used fallback base percentages of 4% / 5% / 6%."
      );
      basis["fee_percentage_rule_fallback"] = {
        baseLowPct,
        baseTargetPct,
        baseHighPct,
      };
    }

    const { data: rawMultipliers, error: multipliersError } = await sb
      .from("complexity_multipliers")
      .select("*")
      .eq("status", "active");

    if (multipliersError) {
      console.error("Failed to load complexity multipliers", multipliersError);
    }

    const multipliers = (rawMultipliers || []) as ComplexityMultiplierRow[];

    const appliedMultipliers: {
      code: string;
      label: string;
      multiplier: number;
      applies_to: string;
    }[] = [];

    const pushMultiplier = (m: ComplexityMultiplierRow) => {
      appliedMultipliers.push({
        code: m.code,
        label: m.label,
        multiplier: Number(m.multiplier),
        applies_to: m.applies_to,
      });
    };

    if (input.complexityLevel) {
      multipliers
        .filter(
          (m) =>
            m.applies_to === "complexity" &&
            m.complexity_level === input.complexityLevel
        )
        .forEach(pushMultiplier);
    }

    if (input.listedBuilding) {
      multipliers
        .filter(
          (m) =>
            m.applies_to === "condition" &&
            m.condition === "listed_building"
        )
        .forEach(pushMultiplier);
    }

    if (input.occupiedSite) {
      multipliers
        .filter(
          (m) =>
            m.applies_to === "condition" &&
            m.condition === "occupied_site"
        )
        .forEach(pushMultiplier);
    }

    if (input.programmePressure) {
      multipliers
        .filter(
          (m) =>
            m.applies_to === "programme" &&
            m.programme_pressure === input.programmePressure
        )
        .forEach(pushMultiplier);
    }

    if (appliedMultipliers.length === 0) {
      assumptions.push(
        "No specific complexity or condition multipliers applied; overall multiplier is 1.0."
      );
    }

    const overallMultiplier = appliedMultipliers.reduce(
      (acc, m) => acc * m.multiplier,
      1
    );

    const pctToDecimal = (pct: number) => pct / 100;

    const feeLow =
      usedMeValue > 0
        ? usedMeValue * pctToDecimal(baseLowPct) * overallMultiplier
        : 0;
    const feeTarget =
      usedMeValue > 0
        ? usedMeValue * pctToDecimal(baseTargetPct) * overallMultiplier
        : 0;
    const feeHigh =
      usedMeValue > 0
        ? usedMeValue * pctToDecimal(baseHighPct) * overallMultiplier
        : 0;

    basis["input"] = input;
    basis["calculation_mode"] = calculationMode;
    basis["overall_multiplier"] = overallMultiplier;
    basis["applied_multipliers"] = appliedMultipliers;

    return {
      calculationMode,
      usedMeValue,
      derivedMeValue,
      baseLowPct,
      baseTargetPct,
      baseHighPct,
      appliedMultipliers,
      overallMultiplier,
      feeLow,
      feeTarget,
      feeHigh,
      assumptions,
      basis,
    };
  },

  async saveQuickFeeScenario(
    userId: string,
    input: QuickFeeInput,
    result: QuickFeeResult
  ): Promise<OpportunityFeeScenarioRow | null> {
    const insertPayload: Partial<OpportunityFeeScenarioRow> = {
      opportunity_id: input.opportunityId,
      name: input.scenarioName || "Quick percentage scenario",
      scenario_type: "quick_percentage",
      calculation_mode: result.calculationMode,
      total_build_value: safeNumber(input.totalBuildValue),
      me_value: safeNumber(input.meValue),
      derived_me_value: result.derivedMeValue,
      sector: input.sector || null,
      building_type: input.buildingType || null,
      project_status: input.projectStatus || null,
      listed_building: input.listedBuilding ?? null,
      occupied_site: input.occupiedSite ?? null,
      complexity_level: input.complexityLevel || null,
      programme_pressure: input.programmePressure || null,
      stages_required: input.stagesRequired || null,
      disciplines_required: input.disciplinesRequired || null,
      base_low_pct: result.baseLowPct,
      base_target_pct: result.baseTargetPct,
      base_high_pct: result.baseHighPct,
      fee_low: result.feeLow,
      fee_target: result.feeTarget,
      fee_high: result.feeHigh,
      selected_fee: result.feeTarget,
      selected_fee_label: "target",
      applied_rule_ids: null,
      calculation_basis: {
        ...result.basis,
        assumptions: result.assumptions,
      } as any,
      is_active: true,
      created_by_user_id: userId,
    };

    const { data, error } = await sb
      .from("opportunity_fee_scenarios")
      .insert(insertPayload as any)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to save quick fee scenario", error);
      return null;
    }

    return data as OpportunityFeeScenarioRow;
  },

  async convertScenarioToEstimate(
    userId: string,
    scenario: OpportunityFeeScenarioRow
  ): Promise<OpportunityEstimateRow | null> {
    const selectedFee =
      scenario.selected_fee ??
      scenario.fee_target ??
      scenario.fee_low ??
      scenario.fee_high;

    const name =
      scenario.name || "Estimate from quick percentage scenario";

    const { data: estimate, error: estimateError } = await sb
      .from("opportunity_estimates")
      .insert({
        opportunity_id: scenario.opportunity_id,
        name,
        status: "draft",
        total_fee: selectedFee,
        currency: "GBP",
        source: "quick_percentage",
        assumptions: null,
        calculation_basis: scenario.calculation_basis as any,
        created_by_user_id: userId,
      } as Partial<OpportunityEstimateRow>)
      .select("*")
      .single();

    if (estimateError || !estimate) {
      console.error("Failed to create estimate from scenario", estimateError);
      return null;
    }

    const createdEstimate = estimate as OpportunityEstimateRow;

    if (selectedFee && selectedFee > 0) {
      const { error: lineItemError } = await sb
        .from("opportunity_estimate_line_items")
        .insert({
          estimate_id: createdEstimate.id,
          sort_order: 0,
          description: "Lump sum fee (derived from quick percentage estimate)",
          quantity: 1,
          unit: "sum",
          rate: selectedFee,
          total: selectedFee,
          stage: null,
          discipline: null,
        } as Partial<OpportunityEstimateLineItemRow>);

      if (lineItemError) {
        console.error(
          "Failed to create initial estimate line item",
          lineItemError
        );
      }
    }

    const { error: updateScenarioError } = await sb
      .from("opportunity_fee_scenarios")
      .update({
        converted_to_estimate_id: createdEstimate.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scenario.id);

    if (updateScenarioError) {
      console.error(
        "Failed to link scenario to new estimate",
        updateScenarioError
      );
    }

    return createdEstimate;
  },
};