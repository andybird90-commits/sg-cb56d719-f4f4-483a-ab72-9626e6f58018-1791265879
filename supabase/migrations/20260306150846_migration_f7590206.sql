-- Re-run DDL for Bid Builder tables and policies, using auth.uid() instead of uid()

-- PART 1: Files attached to opportunities for Bid Builder

CREATE TABLE IF NOT EXISTS public.opportunity_bid_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'opportunity-bid-files',
  storage_object_path text NOT NULL,
  filename text NOT NULL,
  content_type text NULL,
  size_bytes bigint NULL,
  is_bid_builder_input boolean NOT NULL DEFAULT true,
  tags text[] NULL,
  parsed_text text NULL,
  ai_summary jsonb NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunity_bid_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_bid_files' 
      AND policyname = 'Users can insert their own bid files'
  ) THEN
    CREATE POLICY "Users can insert their own bid files"
    ON public.opportunity_bid_files
    FOR INSERT
    TO authenticated
    WITH CHECK (uploaded_by_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_bid_files' 
      AND policyname = 'Users can update their own bid files'
  ) THEN
    CREATE POLICY "Users can update their own bid files"
    ON public.opportunity_bid_files
    FOR UPDATE
    TO authenticated
    USING (uploaded_by_user_id = auth.uid())
    WITH CHECK (uploaded_by_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_bid_files' 
      AND policyname = 'Admins and directors can manage all bid files'
  ) THEN
    CREATE POLICY "Admins and directors can manage all bid files"
    ON public.opportunity_bid_files
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_bid_files' 
      AND policyname = 'All authenticated users can view bid files'
  ) THEN
    CREATE POLICY "All authenticated users can view bid files"
    ON public.opportunity_bid_files
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_opportunity_bid_files_opportunity_id
  ON public.opportunity_bid_files (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_bid_files_uploaded_by
  ON public.opportunity_bid_files (uploaded_by_user_id);

-- PART 2: Admin-managed rules for percentage fee and M&E value

CREATE TABLE IF NOT EXISTS public.fee_percentage_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sector text NULL,
  building_type text NULL,
  project_status text NULL,
  min_me_value numeric NULL,
  max_me_value numeric NULL,
  min_total_build_value numeric NULL,
  max_total_build_value numeric NULL,
  base_low_pct numeric NOT NULL,
  base_target_pct numeric NOT NULL,
  base_high_pct numeric NOT NULL,
  stages text[] NULL,
  disciplines text[] NULL,
  status text NOT NULL DEFAULT 'active',
  notes text NULL,
  created_by_user_id uuid NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fee_percentage_rules_status_check 
    CHECK (status IN ('active','archived'))
);

ALTER TABLE public.fee_percentage_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'fee_percentage_rules' 
      AND policyname = 'Admins and directors can manage fee percentage rules'
  ) THEN
    CREATE POLICY "Admins and directors can manage fee percentage rules"
    ON public.fee_percentage_rules
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'fee_percentage_rules' 
      AND policyname = 'All authenticated users can view fee percentage rules'
  ) THEN
    CREATE POLICY "All authenticated users can view fee percentage rules"
    ON public.fee_percentage_rules
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_fee_percentage_rules_sector_type
  ON public.fee_percentage_rules (sector, building_type, project_status);

CREATE TABLE IF NOT EXISTS public.me_value_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sector text NULL,
  building_type text NULL,
  project_status text NULL,
  min_total_build_value numeric NULL,
  max_total_build_value numeric NULL,
  me_ratio numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notes text NULL,
  created_by_user_id uuid NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT me_value_rules_status_check 
    CHECK (status IN ('active','archived')),
  CONSTRAINT me_value_rules_me_ratio_check 
    CHECK (me_ratio > 0 AND me_ratio < 1)
);

ALTER TABLE public.me_value_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'me_value_rules' 
      AND policyname = 'Admins and directors can manage M&E value rules'
  ) THEN
    CREATE POLICY "Admins and directors can manage M&E value rules"
    ON public.me_value_rules
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'me_value_rules' 
      AND policyname = 'All authenticated users can view M&E value rules'
  ) THEN
    CREATE POLICY "All authenticated users can view M&E value rules"
    ON public.me_value_rules
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_me_value_rules_sector_type
  ON public.me_value_rules (sector, building_type, project_status);

CREATE TABLE IF NOT EXISTS public.complexity_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  label text NOT NULL,
  applies_to text NOT NULL,
  complexity_level text NULL,
  condition text NULL,
  programme_pressure text NULL,
  multiplier numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notes text NULL,
  created_by_user_id uuid NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complexity_multipliers_applies_to_check 
    CHECK (applies_to IN ('complexity','condition','programme')),
  CONSTRAINT complexity_multipliers_status_check 
    CHECK (status IN ('active','archived')),
  CONSTRAINT complexity_multipliers_multiplier_check 
    CHECK (multiplier > 0)
);

ALTER TABLE public.complexity_multipliers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'complexity_multipliers' 
      AND policyname = 'Admins and directors can manage complexity multipliers'
  ) THEN
    CREATE POLICY "Admins and directors can manage complexity multipliers"
    ON public.complexity_multipliers
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'complexity_multipliers' 
      AND policyname = 'All authenticated users can view complexity multipliers'
  ) THEN
    CREATE POLICY "All authenticated users can view complexity multipliers"
    ON public.complexity_multipliers
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_complexity_multipliers_code
  ON public.complexity_multipliers (code);

-- PART 3 & 4: Scenarios and editable estimates linked to opportunities

CREATE TABLE IF NOT EXISTS public.opportunity_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_fee numeric NULL,
  currency text NOT NULL DEFAULT 'GBP',
  source text NULL,
  assumptions text NULL,
  calculation_basis jsonb NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_estimates_status_check 
    CHECK (status IN ('draft','active','archived'))
);

ALTER TABLE public.opportunity_estimates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_estimates' 
      AND policyname = 'Users can manage their own opportunity estimates'
  ) THEN
    CREATE POLICY "Users can manage their own opportunity estimates"
    ON public.opportunity_estimates
    FOR ALL
    TO authenticated
    USING (created_by_user_id = auth.uid())
    WITH CHECK (created_by_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_estimates' 
      AND policyname = 'Admins and directors can manage all opportunity estimates'
  ) THEN
    CREATE POLICY "Admins and directors can manage all opportunity estimates"
    ON public.opportunity_estimates
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_opportunity_estimates_opportunity_id
  ON public.opportunity_estimates (opportunity_id);

CREATE TABLE IF NOT EXISTS public.opportunity_estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.opportunity_estimates(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NULL,
  rate numeric NULL,
  total numeric NULL,
  stage text NULL,
  discipline text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunity_estimate_line_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_estimate_line_items' 
      AND policyname = 'Users can manage line items for their own estimates'
  ) THEN
    CREATE POLICY "Users can manage line items for their own estimates"
    ON public.opportunity_estimate_line_items
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 
        FROM public.opportunity_estimates e 
        WHERE e.id = estimate_id 
          AND e.created_by_user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 
        FROM public.opportunity_estimates e 
        WHERE e.id = estimate_id 
          AND e.created_by_user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_estimate_line_items' 
      AND policyname = 'Admins and directors can manage all estimate line items'
  ) THEN
    CREATE POLICY "Admins and directors can manage all estimate line items"
    ON public.opportunity_estimate_line_items
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_opportunity_estimate_line_items_estimate_id
  ON public.opportunity_estimate_line_items (estimate_id);

CREATE TABLE IF NOT EXISTS public.opportunity_fee_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  name text NOT NULL,
  scenario_type text NOT NULL DEFAULT 'quick_percentage',
  calculation_mode text NOT NULL,
  total_build_value numeric NULL,
  me_value numeric NULL,
  derived_me_value numeric NULL,
  sector text NULL,
  building_type text NULL,
  project_status text NULL,
  listed_building boolean NULL,
  occupied_site boolean NULL,
  complexity_level text NULL,
  programme_pressure text NULL,
  stages_required text[] NULL,
  disciplines_required text[] NULL,
  base_low_pct numeric NULL,
  base_target_pct numeric NULL,
  base_high_pct numeric NULL,
  fee_low numeric NULL,
  fee_target numeric NULL,
  fee_high numeric NULL,
  selected_fee numeric NULL,
  selected_fee_label text NULL,
  applied_rule_ids jsonb NULL,
  calculation_basis jsonb NULL,
  is_active boolean NOT NULL DEFAULT true,
  converted_to_estimate_id uuid NULL REFERENCES public.opportunity_estimates(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_fee_scenarios_scenario_type_check 
    CHECK (scenario_type IN ('quick_percentage','manual','template')),
  CONSTRAINT opportunity_fee_scenarios_calculation_mode_check 
    CHECK (calculation_mode IN ('me_value','total_build'))
);

ALTER TABLE public.opportunity_fee_scenarios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_fee_scenarios' 
      AND policyname = 'Users can manage their own opportunity fee scenarios'
  ) THEN
    CREATE POLICY "Users can manage their own opportunity fee scenarios"
    ON public.opportunity_fee_scenarios
    FOR ALL
    TO authenticated
    USING (created_by_user_id = auth.uid())
    WITH CHECK (created_by_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'opportunity_fee_scenarios' 
      AND policyname = 'Admins and directors can manage all opportunity fee scenarios'
  ) THEN
    CREATE POLICY "Admins and directors can manage all opportunity fee scenarios"
    ON public.opportunity_fee_scenarios
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() 
          AND p.role IN ('admin','director')
      )
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_opportunity_fee_scenarios_opportunity_id
  ON public.opportunity_fee_scenarios (opportunity_id);