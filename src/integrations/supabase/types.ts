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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_grants: {
        Row: {
          active: boolean
          created_at: string
          email: string
          reviewer: string | null
          role: Database["public"]["Enums"]["app_role"]
          store: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          reviewer?: string | null
          role: Database["public"]["Enums"]["app_role"]
          store?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          reviewer?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          store?: string | null
        }
        Relationships: []
      }
      access_log: {
        Row: {
          created_at: string
          email: string
          id: string
          path: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          path?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          path?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      dsa_identity: {
        Row: {
          reviewer: string
          store: string
          user_id: string
        }
        Insert: {
          reviewer: string
          store: string
          user_id: string
        }
        Update: {
          reviewer?: string
          store?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          color: string
          created_at: string
          id: string
          image_url: string | null
          long_style_desc: string
          retail_price: number | null
          season: string | null
          sort_order: number
          style_number: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          image_url?: string | null
          long_style_desc: string
          retail_price?: number | null
          season?: string | null
          sort_order?: number
          style_number: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          image_url?: string | null
          long_style_desc?: string
          retail_price?: number | null
          season?: string | null
          sort_order?: number
          style_number?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          decision_status: Database["public"]["Enums"]["decision_status"] | null
          id: string
          notes: string | null
          processed: boolean
          processed_at: string | null
          product_id: string
          requested_bulk_units: number | null
          reviewer: string
          selected_sizes: number[]
          special_order_notes: string | null
          store: string
          submission_status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_status?:
            | Database["public"]["Enums"]["decision_status"]
            | null
          id?: string
          notes?: string | null
          processed?: boolean
          processed_at?: string | null
          product_id: string
          requested_bulk_units?: number | null
          reviewer: string
          selected_sizes?: number[]
          special_order_notes?: string | null
          store?: string
          submission_status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_status?:
            | Database["public"]["Enums"]["decision_status"]
            | null
          id?: string
          notes?: string | null
          processed?: boolean
          processed_at?: string | null
          product_id?: string
          requested_bulk_units?: number | null
          reviewer?: string
          selected_sizes?: number[]
          special_order_notes?: string | null
          store?: string
          submission_status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_access_review: {
        Args: { _reviewer: string; _store: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_review_processed: {
        Args: { _review_id: string; _value: boolean }
        Returns: {
          created_at: string
          decision_status: Database["public"]["Enums"]["decision_status"] | null
          id: string
          notes: string | null
          processed: boolean
          processed_at: string | null
          product_id: string
          requested_bulk_units: number | null
          reviewer: string
          selected_sizes: number[]
          special_order_notes: string | null
          store: string
          submission_status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "buyer" | "dsa"
      decision_status: "green" | "yellow" | "red"
      submission_status: "draft" | "submitted"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["buyer", "dsa"],
      decision_status: ["green", "yellow", "red"],
      submission_status: ["draft", "submitted"],
    },
  },
} as const
