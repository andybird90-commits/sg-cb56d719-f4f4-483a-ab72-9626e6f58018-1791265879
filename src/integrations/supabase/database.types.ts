 
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          sector: string | null
          short_name: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          sector?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          sector?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          job_title: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          job_title?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          job_title?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budgets: {
        Row: {
          budget_cost: number | null
          budget_revenue: number
          created_at: string
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          budget_cost?: number | null
          budget_revenue: number
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          budget_cost?: number | null
          budget_revenue?: number
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          description: string | null
          expected_end_date: string | null
          expected_fee_value: number | null
          expected_start_date: string | null
          id: string
          linked_project_id: string | null
          name: string
          probability_percent: number | null
          stage: string
          status: string
          tender_due_date: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          expected_end_date?: string | null
          expected_fee_value?: number | null
          expected_start_date?: string | null
          id?: string
          linked_project_id?: string | null
          name: string
          probability_percent?: number | null
          stage: string
          status?: string
          tender_due_date?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          expected_end_date?: string | null
          expected_fee_value?: number | null
          expected_start_date?: string | null
          id?: string
          linked_project_id?: string | null
          name?: string
          probability_percent?: number | null
          stage?: string
          status?: string
          tender_due_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          annual_holiday_days: number | null
          avatar_url: string | null
          created_at: string | null
          default_hourly_cost_rate: number | null
          email: string
          full_name: string
          holiday_cost_rate: number | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          annual_holiday_days?: number | null
          avatar_url?: string | null
          created_at?: string | null
          default_hourly_cost_rate?: number | null
          email: string
          full_name: string
          holiday_cost_rate?: number | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          annual_holiday_days?: number | null
          avatar_url?: string | null
          created_at?: string | null
          default_hourly_cost_rate?: number | null
          email?: string
          full_name?: string
          holiday_cost_rate?: number | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      project_activities: {
        Row: {
          activity_type: string | null
          billable: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activity_type?: string | null
          billable?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activity_type?: string | null
          billable?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_monthly_phasing: {
        Row: {
          created_at: string | null
          id: string
          month: number
          project_id: string
          revenue_amount: number
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          month: number
          project_id: string
          revenue_amount?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          month?: number
          project_id?: string
          revenue_amount?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_monthly_phasing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agreed_fee_value: number | null
          client_company_id: string
          code: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          opportunity_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreed_fee_value?: number | null
          client_company_id: string
          code: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          opportunity_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreed_fee_value?: number | null
          client_company_id?: string
          code?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          opportunity_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_costs: {
        Row: {
          cost_amount: number
          cost_date: string
          created_at: string
          description: string | null
          id: string
          project_id: string
          supplier_name: string
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          cost_amount: number
          cost_date: string
          created_at?: string
          description?: string | null
          id?: string
          project_id: string
          supplier_name: string
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          cost_amount?: number
          cost_date?: string
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string
          supplier_name?: string
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_costs_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          activity_id: string | null
          created_at: string
          date: string
          hours: number
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          user_id: string
          variation_id: string | null
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          date: string
          hours: number
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          user_id: string
          variation_id?: string | null
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          date?: string
          hours?: number
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "project_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "variations"
            referencedColumns: ["id"]
          },
        ]
      }
      variations: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          project_id: string
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          project_id: string
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "variations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      company_status: "active" | "prospect" | "inactive"
      user_role: "admin" | "director" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      company_status: ["active", "prospect", "inactive"],
      user_role: ["admin", "director", "user"],
    },
  },
} as const
