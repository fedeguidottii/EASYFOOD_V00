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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          created_at: string
          date_time: string
          email: string | null
          guests: number
          id: string
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string | null
          status: string | null
          table_id: string | null
        }
        Insert: {
          created_at?: string
          date_time: string
          email?: string | null
          guests: number
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string | null
          status?: string | null
          table_id?: string | null
        }
        Update: {
          created_at?: string
          date_time?: string
          email?: string | null
          guests?: number
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string | null
          status?: string | null
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          course_number: number | null
          created_at: string | null
          dish_id: string | null
          id: string
          notes: string | null
          quantity: number | null
          session_id: string | null
          updated_at: string | null
        }
        Insert: {
          course_number?: number | null
          created_at?: string | null
          dish_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number | null
          session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          course_number?: number | null
          created_at?: string | null
          dish_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number | null
          session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          order: number | null
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order?: number | null
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order?: number | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_menu_dishes: {
        Row: {
          created_at: string | null
          custom_menu_id: string
          dish_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          custom_menu_id: string
          dish_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          custom_menu_id?: string
          dish_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_menu_dishes_custom_menu_id_fkey"
            columns: ["custom_menu_id"]
            isOneToOne: false
            referencedRelation: "custom_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_menu_dishes_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_menu_schedules: {
        Row: {
          created_at: string | null
          custom_menu_id: string
          day_of_week: number | null
          end_time: string | null
          id: string
          is_active: boolean | null
          meal_type: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          custom_menu_id: string
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          meal_type?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          custom_menu_id?: string
          day_of_week?: number | null
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          meal_type?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_menu_schedules_custom_menu_id_fkey"
            columns: ["custom_menu_id"]
            isOneToOne: false
            referencedRelation: "custom_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_menus: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_menus_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          allergens: string[] | null
          category_id: string | null
          created_at: string
          description: string | null
          exclude_from_all_you_can_eat: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_ayce: boolean | null
          name: string
          price: number
          restaurant_id: string | null
          vat_rate: number | null
        }
        Insert: {
          allergens?: string[] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          exclude_from_all_you_can_eat?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_ayce?: boolean | null
          name: string
          price: number
          restaurant_id?: string | null
          vat_rate?: number | null
        }
        Update: {
          allergens?: string[] | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          exclude_from_all_you_can_eat?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_ayce?: boolean | null
          name?: string
          price?: number
          restaurant_id?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          course_number: number | null
          created_at: string
          dish_id: string | null
          id: string
          note: string | null
          order_id: string | null
          quantity: number
          ready_at: string | null
          restaurant_id: string | null
          status: string
        }
        Insert: {
          course_number?: number | null
          created_at?: string
          dish_id?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          quantity?: number
          ready_at?: string | null
          restaurant_id?: string | null
          status?: string
        }
        Update: {
          course_number?: number | null
          created_at?: string
          dish_id?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          quantity?: number
          ready_at?: string | null
          restaurant_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          restaurant_id: string | null
          status: string
          table_session_id: string | null
          total_amount: number | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          restaurant_id?: string | null
          status?: string
          table_session_id?: string | null
          total_amount?: number | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          restaurant_id?: string | null
          status?: string
          table_session_id?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          password: string | null
          restaurant_id: string | null
          role: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          password?: string | null
          restaurant_id?: string | null
          role: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          password?: string | null
          restaurant_id?: string | null
          role?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          all_you_can_eat: Json | null
          allow_waiter_payments: boolean
          cover_charge_per_person: number | null
          created_at: string
          email: string | null
          enable_course_splitting: boolean | null
          enable_public_reservations: boolean | null
          enable_reservation_room_selection: boolean | null
          hours: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          menu_primary_color: string | null
          menu_style: string | null
          name: string
          owner_id: string | null
          phone: string | null
          show_cooking_times: boolean | null
          view_only_menu_enabled: boolean | null
          waiter_mode_enabled: boolean
          waiter_password: string | null
          weekly_ayce: Json | null
          weekly_coperto: Json | null
          weekly_service_hours: Json | null
        }
        Insert: {
          address?: string | null
          all_you_can_eat?: Json | null
          allow_waiter_payments?: boolean
          cover_charge_per_person?: number | null
          created_at?: string
          email?: string | null
          enable_course_splitting?: boolean | null
          enable_public_reservations?: boolean | null
          enable_reservation_room_selection?: boolean | null
          hours?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          menu_primary_color?: string | null
          menu_style?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          show_cooking_times?: boolean | null
          view_only_menu_enabled?: boolean | null
          waiter_mode_enabled?: boolean
          waiter_password?: string | null
          weekly_ayce?: Json | null
          weekly_coperto?: Json | null
          weekly_service_hours?: Json | null
        }
        Update: {
          address?: string | null
          all_you_can_eat?: Json | null
          allow_waiter_payments?: boolean
          cover_charge_per_person?: number | null
          created_at?: string
          email?: string | null
          enable_course_splitting?: boolean | null
          enable_public_reservations?: boolean | null
          enable_reservation_room_selection?: boolean | null
          hours?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          menu_primary_color?: string | null
          menu_style?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          show_cooking_times?: boolean | null
          view_only_menu_enabled?: boolean | null
          waiter_mode_enabled?: boolean
          waiter_password?: string | null
          weekly_ayce?: Json | null
          weekly_coperto?: Json | null
          weekly_service_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          order: number | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order?: number | null
          restaurant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order?: number | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          ayce_enabled: boolean | null
          closed_at: string | null
          coperto_enabled: boolean | null
          customer_count: number | null
          id: string
          opened_at: string
          restaurant_id: string | null
          session_pin: string | null
          status: string
          table_id: string | null
        }
        Insert: {
          ayce_enabled?: boolean | null
          closed_at?: string | null
          coperto_enabled?: boolean | null
          customer_count?: number | null
          id?: string
          opened_at?: string
          restaurant_id?: string | null
          session_pin?: string | null
          status?: string
          table_id?: string | null
        }
        Update: {
          ayce_enabled?: boolean | null
          closed_at?: string | null
          coperto_enabled?: boolean | null
          customer_count?: number | null
          id?: string
          opened_at?: string
          restaurant_id?: string | null
          session_pin?: string | null
          status?: string
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          last_assistance_request: string | null
          number: string
          pin: string | null
          restaurant_id: string | null
          room_id: string | null
          seats: number | null
          status: string | null
          token: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_assistance_request?: string | null
          number: string
          pin?: string | null
          restaurant_id?: string | null
          room_id?: string | null
          seats?: number | null
          status?: string | null
          token?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_assistance_request?: string | null
          number?: string
          pin?: string | null
          restaurant_id?: string | null
          room_id?: string | null
          seats?: number | null
          status?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          password_hash: string | null
          role: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          password_hash?: string | null
          role: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          password_hash?: string | null
          role?: string
          username?: string | null
        }
        Relationships: []
      }
      waiter_activity_logs: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          restaurant_id: string
          waiter_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          restaurant_id: string
          waiter_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          restaurant_id?: string
          waiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_activity_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_activity_logs_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_custom_menu:
        | { Args: { menu_id: string }; Returns: undefined }
        | {
            Args: { p_menu_id: string; p_restaurant_id: string }
            Returns: undefined
          }
      get_average_cooking_time: {
        Args: { p_dish_id: number; p_restaurant_id: number }
        Returns: number
      }
      get_dish_avg_cooking_times: {
        Args: { p_restaurant_id: string }
        Returns: {
          avg_minutes: number
          dish_id: string
        }[]
      }
      get_or_create_table_session: {
        Args: { p_restaurant_id: string; p_table_id: string }
        Returns: string
      }
      is_restaurant_staff: { Args: { r_id: string }; Returns: boolean }
      reset_to_full_menu: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
