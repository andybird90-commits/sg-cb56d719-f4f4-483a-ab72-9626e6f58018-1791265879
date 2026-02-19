 
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
      calendar_events: {
        Row: {
          all_day: boolean | null
          created_at: string | null
          created_by_user_id: string
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          location: string | null
          start_time: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string | null
          created_by_user_id: string
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type: string
          id?: string
          location?: string | null
          start_time?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          created_at?: string | null
          created_by_user_id?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          location?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          added_by_user_id: string | null
          company_number: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          payment_terms: number | null
          sector: string | null
          short_name: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
        }
        Insert: {
          added_by_user_id?: string | null
          company_number?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          payment_terms?: number | null
          sector?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Update: {
          added_by_user_id?: string | null
          company_number?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: number | null
          sector?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_added_by_user_id_fkey"
            columns: ["added_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_events: {
        Row: {
          contact_id: string
          created_at: string | null
          created_by: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          location: string | null
          notes: string | null
          start_time: string | null
          title: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          event_date: string
          event_type: string
          id?: string
          location?: string | null
          notes?: string | null
          start_time?: string | null
          title: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_timeline: {
        Row: {
          contact_id: string
          content: string
          created_at: string | null
          created_by_user_id: string | null
          event_id: string | null
          id: string
          post_type: string
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string | null
          created_by_user_id?: string | null
          event_id?: string | null
          id?: string
          post_type: string
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string | null
          created_by_user_id?: string | null
          event_id?: string | null
          id?: string
          post_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_timeline_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_timeline_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_timeline_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "contact_events"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          added_by_user_id: string | null
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
          added_by_user_id?: string | null
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
          added_by_user_id?: string | null
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
            foreignKeyName: "contacts_added_by_user_id_fkey"
            columns: ["added_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_collections: {
        Row: {
          collected_by_user_id: string | null
          collected_date: string | null
          created_at: string | null
          due_date: string
          id: string
          invoice_item_id: string
          invoice_month_id: string
          updated_at: string | null
        }
        Insert: {
          collected_by_user_id?: string | null
          collected_date?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          invoice_item_id: string
          invoice_month_id: string
          updated_at?: string | null
        }
        Update: {
          collected_by_user_id?: string | null
          collected_date?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_item_id?: string
          invoice_month_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_collections_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_collections_invoice_month_id_fkey"
            columns: ["invoice_month_id"]
            isOneToOne: false
            referencedRelation: "invoice_months"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_history: {
        Row: {
          client_name: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          due_date: string
          gross_amount: number | null
          id: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          notes: string | null
          paid_amount: number | null
          po_reference: string | null
          project_id: string | null
          project_name: string | null
          status: string | null
          updated_at: string | null
          vat_amount: number | null
        }
        Insert: {
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date: string
          gross_amount?: number | null
          id?: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          notes?: string | null
          paid_amount?: number | null
          po_reference?: string | null
          project_id?: string | null
          project_name?: string | null
          status?: string | null
          updated_at?: string | null
          vat_amount?: number | null
        }
        Update: {
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string
          gross_amount?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          net_amount?: number
          notes?: string | null
          paid_amount?: number | null
          po_reference?: string | null
          project_id?: string | null
          project_name?: string | null
          status?: string | null
          updated_at?: string | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          client_name: string
          created_at: string | null
          created_by: string | null
          description: string | null
          excluded_this_month: boolean | null
          id: string
          invoice_month_id: string
          invoice_reference: string | null
          invoice_value: number | null
          po_number: string | null
          project_code: string | null
          project_id: string
          project_name: string
          updated_at: string | null
        }
        Insert: {
          client_name: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          excluded_this_month?: boolean | null
          id?: string
          invoice_month_id: string
          invoice_reference?: string | null
          invoice_value?: number | null
          po_number?: string | null
          project_code?: string | null
          project_id: string
          project_name: string
          updated_at?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          excluded_this_month?: boolean | null
          id?: string
          invoice_month_id?: string
          invoice_reference?: string | null
          invoice_value?: number | null
          po_number?: string | null
          project_code?: string | null
          project_id?: string
          project_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_month_id_fkey"
            columns: ["invoice_month_id"]
            isOneToOne: false
            referencedRelation: "invoice_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_months: {
        Row: {
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          month: number
          pdf_url: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          month: number
          pdf_url?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          month?: number
          pdf_url?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_months_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          overhead: number | null
          total_staff_cost: number | null
          updated_at: string
          year: number
        }
        Insert: {
          budget_cost?: number | null
          budget_revenue: number
          created_at?: string
          id?: string
          month: number
          overhead?: number | null
          total_staff_cost?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          budget_cost?: number | null
          budget_revenue?: number
          created_at?: string
          id?: string
          month?: number
          overhead?: number | null
          total_staff_cost?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          added_by_user_id: string | null
          archived: boolean | null
          archived_at: string | null
          archived_by_user_id: string | null
          archived_reason: string | null
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
          probability_percent: number
          project_reference: string | null
          stage: string
          status: string
          submitted_date: string | null
          tender_due_date: string | null
          tender_received_date: string | null
          updated_at: string
        }
        Insert: {
          added_by_user_id?: string | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          archived_reason?: string | null
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
          probability_percent?: number
          project_reference?: string | null
          stage: string
          status?: string
          submitted_date?: string | null
          tender_due_date?: string | null
          tender_received_date?: string | null
          updated_at?: string
        }
        Update: {
          added_by_user_id?: string | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          archived_reason?: string | null
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
          probability_percent?: number
          project_reference?: string | null
          stage?: string
          status?: string
          submitted_date?: string | null
          tender_due_date?: string | null
          tender_received_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_added_by_user_id_fkey"
            columns: ["added_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_archived_by_user_id_fkey"
            columns: ["archived_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      opportunity_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          location: string | null
          notes: string | null
          opportunity_id: string
          start_time: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          event_date: string
          event_type: string
          id?: string
          location?: string | null
          notes?: string | null
          opportunity_id: string
          start_time?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          opportunity_id?: string
          start_time?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_monthly_phasing: {
        Row: {
          created_at: string | null
          id: string
          month: number
          opportunity_id: string
          revenue_amount: number
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          month: number
          opportunity_id: string
          revenue_amount?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          month?: number
          opportunity_id?: string
          revenue_amount?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_monthly_phasing_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_timeline: {
        Row: {
          content: string
          created_at: string | null
          created_by_user_id: string
          event_id: string | null
          id: string
          opportunity_id: string
          post_type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by_user_id: string
          event_id?: string | null
          id?: string
          opportunity_id: string
          post_type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by_user_id?: string
          event_id?: string | null
          id?: string
          opportunity_id?: string
          post_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_timeline_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_timeline_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "opportunity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_timeline_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_items: {
        Row: {
          created_at: string | null
          due_date: string | null
          end_datetime: string | null
          ics_last_generated_at: string | null
          ics_uid: string | null
          id: string
          location: string | null
          next_step: string | null
          notes: string | null
          owner_user_id: string
          pinned: boolean | null
          start_datetime: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          due_date?: string | null
          end_datetime?: string | null
          ics_last_generated_at?: string | null
          ics_uid?: string | null
          id?: string
          location?: string | null
          next_step?: string | null
          notes?: string | null
          owner_user_id: string
          pinned?: boolean | null
          start_datetime?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          due_date?: string | null
          end_datetime?: string | null
          ics_last_generated_at?: string | null
          ics_uid?: string | null
          id?: string
          location?: string | null
          next_step?: string | null
          notes?: string | null
          owner_user_id?: string
          pinned?: boolean | null
          start_datetime?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      planner_links: {
        Row: {
          created_at: string | null
          id: string
          link_id: string
          link_type: string
          planner_item_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link_id: string
          link_type: string
          planner_item_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link_id?: string
          link_type?: string
          planner_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_links_planner_item_id_fkey"
            columns: ["planner_item_id"]
            isOneToOne: false
            referencedRelation: "planner_items"
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
          hourly_rate: number | null
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
          hourly_rate?: number | null
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
          hourly_rate?: number | null
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
          actual_revenue: number | null
          created_at: string | null
          id: string
          invoice_date: string | null
          invoice_ref: string | null
          invoice_status: string | null
          month: number
          project_id: string
          revenue_amount: number
          updated_at: string | null
          year: number
        }
        Insert: {
          actual_revenue?: number | null
          created_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_ref?: string | null
          invoice_status?: string | null
          month: number
          project_id: string
          revenue_amount?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          actual_revenue?: number | null
          created_at?: string | null
          id?: string
          invoice_date?: string | null
          invoice_ref?: string | null
          invoice_status?: string | null
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
          archived: boolean | null
          archived_at: string | null
          archived_by_user_id: string | null
          archived_reason: string | null
          client_company_id: string
          code: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          opportunity_id: string | null
          opportunity_reference: string | null
          po_number: string | null
          project_reference: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreed_fee_value?: number | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          archived_reason?: string | null
          client_company_id: string
          code?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          opportunity_id?: string | null
          opportunity_reference?: string | null
          po_number?: string | null
          project_reference?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreed_fee_value?: number | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by_user_id?: string | null
          archived_reason?: string | null
          client_company_id?: string
          code?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          opportunity_id?: string | null
          opportunity_reference?: string | null
          po_number?: string | null
          project_reference?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_archived_by_user_id_fkey"
            columns: ["archived_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          code: string | null
          created_at: string
          created_by_user_id: string | null
          description: string
          id: string
          po_number: string | null
          project_id: string
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description: string
          id?: string
          po_number?: string | null
          project_id: string
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          id?: string
          po_number?: string | null
          project_id?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "variations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      generate_opportunity_reference: { Args: never; Returns: string }
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
