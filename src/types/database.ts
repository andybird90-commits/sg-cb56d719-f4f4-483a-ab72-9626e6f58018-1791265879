export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: "admin" | "director" | "user"
          default_hourly_cost_rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          role?: "admin" | "director" | "user"
          default_hourly_cost_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          role?: "admin" | "director" | "user"
          default_hourly_cost_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      companies: {
        Row: {
          id: string
          name: string
          short_name: string | null
          sector: string | null
          status: "active" | "prospect" | "inactive"
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          short_name?: string | null
          sector?: string | null
          status?: "active" | "prospect" | "inactive"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          short_name?: string | null
          sector?: string | null
          status?: "active" | "prospect" | "inactive"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          company_id: string
          name: string
          email: string | null
          phone: string | null
          job_title: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          email?: string | null
          phone?: string | null
          job_title?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          job_title?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      opportunities: {
        Row: {
          id: string
          company_id: string
          contact_id: string | null
          name: string
          description: string | null
          stage: "secured" | "high_potential" | "bid"
          status: "open" | "closed_won" | "closed_lost"
          tender_due_date: string | null
          expected_start_date: string | null
          expected_end_date: string | null
          expected_fee_value: number | null
          probability_percent: number | null
          linked_project_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          contact_id?: string | null
          name: string
          description?: string | null
          stage?: "secured" | "high_potential" | "bid"
          status?: "open" | "closed_won" | "closed_lost"
          tender_due_date?: string | null
          expected_start_date?: string | null
          expected_end_date?: string | null
          expected_fee_value?: number | null
          probability_percent?: number | null
          linked_project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          contact_id?: string | null
          name?: string
          description?: string | null
          stage?: "secured" | "high_potential" | "bid"
          status?: "open" | "closed_won" | "closed_lost"
          tender_due_date?: string | null
          expected_start_date?: string | null
          expected_end_date?: string | null
          expected_fee_value?: number | null
          probability_percent?: number | null
          linked_project_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string
          code: string
          name: string
          opportunity_id: string | null
          client_company_id: string
          start_date: string | null
          end_date: string | null
          status: "pipeline" | "live" | "on_hold" | "completed"
          agreed_fee_value: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          opportunity_id?: string | null
          client_company_id: string
          start_date?: string | null
          end_date?: string | null
          status?: "pipeline" | "live" | "on_hold" | "completed"
          agreed_fee_value?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          opportunity_id?: string | null
          client_company_id?: string
          start_date?: string | null
          end_date?: string | null
          status?: "pipeline" | "live" | "on_hold" | "completed"
          agreed_fee_value?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_company_id_fkey"
            columns: ["client_company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      project_activities: {
        Row: {
          id: string
          project_id: string
          name: string
          activity_type: string | null
          billable: boolean
          status: "not_started" | "in_progress" | "complete"
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          activity_type?: string | null
          billable?: boolean
          status?: "not_started" | "in_progress" | "complete"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          activity_type?: string | null
          billable?: boolean
          status?: "not_started" | "in_progress" | "complete"
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activities_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      variations: {
        Row: {
          id: string
          project_id: string
          code: string
          description: string | null
          value: number
          status: "proposed" | "accepted" | "rejected"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          code: string
          description?: string | null
          value: number
          status?: "proposed" | "accepted" | "rejected"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          code?: string
          description?: string | null
          value?: number
          status?: "proposed" | "accepted" | "rejected"
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variations_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      timesheets: {
        Row: {
          id: string
          user_id: string
          date: string
          project_id: string
          activity_id: string | null
          variation_id: string | null
          hours: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          project_id: string
          activity_id?: string | null
          variation_id?: string | null
          hours: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          project_id?: string
          activity_id?: string | null
          variation_id?: string | null
          hours?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_activity_id_fkey"
            columns: ["activity_id"]
            referencedRelation: "project_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_variation_id_fkey"
            columns: ["variation_id"]
            referencedRelation: "variations"
            referencedColumns: ["id"]
          }
        ]
      }
      subcontractor_costs: {
        Row: {
          id: string
          project_id: string
          variation_id: string | null
          supplier_name: string
          description: string | null
          cost_amount: number
          cost_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          variation_id?: string | null
          supplier_name: string
          description?: string | null
          cost_amount: number
          cost_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          variation_id?: string | null
          supplier_name?: string
          description?: string | null
          cost_amount?: number
          cost_date?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_costs_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_costs_variation_id_fkey"
            columns: ["variation_id"]
            referencedRelation: "variations"
            referencedColumns: ["id"]
          }
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
      user_role: "admin" | "director" | "user"
      company_status: "active" | "prospect" | "inactive"
      opportunity_stage: "secured" | "high_potential" | "bid"
      opportunity_status: "open" | "closed_won" | "closed_lost"
      project_status: "pipeline" | "live" | "on_hold" | "completed"
      activity_status: "not_started" | "in_progress" | "complete"
      variation_status: "proposed" | "accepted" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}