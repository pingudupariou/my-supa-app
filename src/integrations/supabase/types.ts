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
      costflow_products: {
        Row: {
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
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          latitude: number | null
          longitude: number | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          pricing_tier: string
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
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          pricing_tier?: string
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
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          pricing_tier?: string
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
      app_role: "admin" | "finance" | "board" | "investisseur" | "lecteur"
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
      app_role: ["admin", "finance", "board", "investisseur", "lecteur"],
    },
  },
} as const
