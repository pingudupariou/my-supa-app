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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      b2b_client_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: []
      }
      b2b_client_projections: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          projected_revenue: number | null
          user_id: string
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          projected_revenue?: number | null
          user_id: string
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          projected_revenue?: number | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "b2b_client_projections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "b2b_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_clients: {
        Row: {
          category_id: string | null
          client_type: string | null
          company_name: string
          contact_email: string | null
          contract_exclusivity: boolean | null
          contract_sign_date: string | null
          country: string | null
          created_at: string
          delivery_fee_rule: string | null
          delivery_method: string | null
          eer_date: number | null
          geographic_zone: string | null
          id: string
          is_active: boolean
          last_purchase_date: number | null
          moq: string | null
          notes: string | null
          payment_terms: string | null
          pricing_rule: string | null
          specific_advantages: string | null
          termination_notice: string | null
          transport_rules: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          client_type?: string | null
          company_name: string
          contact_email?: string | null
          contract_exclusivity?: boolean | null
          contract_sign_date?: string | null
          country?: string | null
          created_at?: string
          delivery_fee_rule?: string | null
          delivery_method?: string | null
          eer_date?: number | null
          geographic_zone?: string | null
          id?: string
          is_active?: boolean
          last_purchase_date?: number | null
          moq?: string | null
          notes?: string | null
          payment_terms?: string | null
          pricing_rule?: string | null
          specific_advantages?: string | null
          termination_notice?: string | null
          transport_rules?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          client_type?: string | null
          company_name?: string
          contact_email?: string | null
          contract_exclusivity?: boolean | null
          contract_sign_date?: string | null
          country?: string | null
          created_at?: string
          delivery_fee_rule?: string | null
          delivery_method?: string | null
          eer_date?: number | null
          geographic_zone?: string | null
          id?: string
          is_active?: boolean
          last_purchase_date?: number | null
          moq?: string | null
          notes?: string | null
          payment_terms?: string | null
          pricing_rule?: string | null
          specific_advantages?: string | null
          termination_notice?: string | null
          transport_rules?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_clients_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "b2b_client_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_delivery_fee_tiers: {
        Row: {
          created_at: string
          fee_amount: number
          id: string
          label: string
          max_pieces: number | null
          min_pieces: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          id?: string
          label: string
          max_pieces?: number | null
          min_pieces?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          fee_amount?: number
          id?: string
          label?: string
          max_pieces?: number | null
          min_pieces?: number | null
          user_id?: string
        }
        Relationships: []
      }
      b2b_delivery_methods: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      b2b_payment_terms_options: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      costflow_bom: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          reference_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          reference_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reference_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "costflow_bom_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "costflow_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costflow_bom_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "costflow_references"
            referencedColumns: ["id"]
          },
        ]
      }
      costflow_meeting_tasks: {
        Row: {
          created_at: string
          description: string
          id: string
          is_completed: boolean
          meeting_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_completed?: boolean
          meeting_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_completed?: boolean
          meeting_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "costflow_meeting_tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "costflow_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      costflow_meetings: {
        Row: {
          content: string
          created_at: string
          id: string
          meeting_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          meeting_date?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meeting_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      costflow_planning_blocks: {
        Row: {
          color_id: string | null
          created_at: string
          duration: number
          id: string
          label: string
          row_id: string
          start_month: number
          user_id: string
        }
        Insert: {
          color_id?: string | null
          created_at?: string
          duration?: number
          id?: string
          label?: string
          row_id: string
          start_month?: number
          user_id: string
        }
        Update: {
          color_id?: string | null
          created_at?: string
          duration?: number
          id?: string
          label?: string
          row_id?: string
          start_month?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "costflow_planning_blocks_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "costflow_planning_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costflow_planning_blocks_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "costflow_planning_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      costflow_planning_colors: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      costflow_planning_notes: {
        Row: {
          block_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_id: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "costflow_planning_notes_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "costflow_planning_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      costflow_planning_rows: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      costflow_product_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      costflow_products: {
        Row: {
          category_id: string | null
          coefficient: number | null
          comments: string | null
          created_at: string
          default_volume: number | null
          family: string | null
          id: string
          main_supplier: string | null
          name: string
          price_ttc: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          coefficient?: number | null
          comments?: string | null
          created_at?: string
          default_volume?: number | null
          family?: string | null
          id?: string
          main_supplier?: string | null
          name: string
          price_ttc?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          coefficient?: number | null
          comments?: string | null
          created_at?: string
          default_volume?: number | null
          family?: string | null
          id?: string
          main_supplier?: string | null
          name?: string
          price_ttc?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "costflow_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "costflow_product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      costflow_reference_files: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          reference_id: string
          uploaded_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          reference_id: string
          uploaded_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          reference_id?: string
          uploaded_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "costflow_reference_files_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "costflow_references"
            referencedColumns: ["id"]
          },
        ]
      }
      costflow_references: {
        Row: {
          category: string | null
          code: string
          comments: string | null
          created_at: string
          currency: string | null
          id: string
          name: string
          price_vol_100: number | null
          price_vol_1000: number | null
          price_vol_10000: number | null
          price_vol_200: number | null
          price_vol_2000: number | null
          price_vol_50: number | null
          price_vol_500: number | null
          price_vol_5000: number | null
          revision: string | null
          supplier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          code: string
          comments?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          name: string
          price_vol_100?: number | null
          price_vol_1000?: number | null
          price_vol_10000?: number | null
          price_vol_200?: number | null
          price_vol_2000?: number | null
          price_vol_50?: number | null
          price_vol_500?: number | null
          price_vol_5000?: number | null
          revision?: string | null
          supplier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          code?: string
          comments?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          name?: string
          price_vol_100?: number | null
          price_vol_1000?: number | null
          price_vol_10000?: number | null
          price_vol_200?: number | null
          price_vol_2000?: number | null
          price_vol_50?: number | null
          price_vol_500?: number | null
          price_vol_5000?: number | null
          revision?: string | null
          supplier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      costflow_suppliers: {
        Row: {
          comments: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_interactions: {
        Row: {
          content: string | null
          created_at: string
          customer_id: string
          id: string
          interaction_date: string
          interaction_type: string
          subject: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          customer_id: string
          id?: string
          interaction_date?: string
          interaction_type?: string
          subject?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          interaction_date?: string
          interaction_type?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_opportunities: {
        Row: {
          contact_name: string | null
          created_at: string
          customer_id: string
          estimated_amount: number | null
          expected_close_date: string | null
          id: string
          next_action: string | null
          next_action_date: string | null
          priority: string | null
          probability: number | null
          responsible: string | null
          sort_order: number | null
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          customer_id: string
          estimated_amount?: number | null
          expected_close_date?: string | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          priority?: string | null
          probability?: number | null
          responsible?: string | null
          sort_order?: number | null
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          customer_id?: string
          estimated_amount?: number | null
          expected_close_date?: string | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          priority?: string | null
          probability?: number | null
          responsible?: string | null
          sort_order?: number | null
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_orders: {
        Row: {
          created_at: string
          customer_id: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_reference: string
          product_category: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_reference: string
          product_category?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_reference?: string
          product_category?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          last_interaction_date: string | null
          latitude: number | null
          longitude: number | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          pricing_tier: string
          priority: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_interaction_date?: string | null
          latitude?: number | null
          longitude?: number | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          pricing_tier?: string
          priority?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_interaction_date?: string | null
          latitude?: number | null
          longitude?: number | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          pricing_tier?: string
          priority?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_scenarios: {
        Row: {
          created_at: string
          id: string
          state_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          state_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          state_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_images: {
        Row: {
          id: string
          image_url: string
          page_key: string
          slot_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          image_url: string
          page_key: string
          slot_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          image_url?: string
          page_key?: string
          slot_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          config_data: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config_data?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config_data?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          name: string
          state_data: Json
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          name: string
          state_data?: Json
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          name?: string
          state_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      tab_permissions: {
        Row: {
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          tab_key: string
        }
        Insert: {
          id?: string
          permission?: string
          role: Database["public"]["Enums"]["app_role"]
          tab_key: string
        }
        Update: {
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          tab_key?: string
        }
        Relationships: []
      }
      timetracking_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      timetracking_entries: {
        Row: {
          category_id: string | null
          comments: string | null
          created_at: string
          date: string
          duration_minutes: number
          id: string
          task_description: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          comments?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          task_description: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          comments?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          task_description?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetracking_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "timetracking_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "finance"
        | "board"
        | "investisseur"
        | "lecteur"
        | "bureau_etude"
        | "production"
        | "marketing"
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
      app_role: [
        "admin",
        "finance",
        "board",
        "investisseur",
        "lecteur",
        "bureau_etude",
        "production",
        "marketing",
      ],
    },
  },
} as const
