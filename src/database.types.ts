export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      deposit_requests: {
        Row: {
          amount: number;
          created_at: string;
          id: number;
          processed_at: string | null;
          processed_by: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: never;
          processed_at?: string | null;
          processed_by?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: never;
          processed_at?: string | null;
          processed_by?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      draw_history: {
        Row: {
          draw_id: number | null;
          drawn_at: string;
          id: number;
          lottery_id: string | null;
          prize_gold: number;
          ticket_number: number | null;
          winner_user_id: string | null;
          winner_username: string | null;
        };
        Insert: {
          draw_id?: number | null;
          drawn_at?: string;
          id?: never;
          lottery_id?: string | null;
          prize_gold: number;
          ticket_number?: number | null;
          winner_user_id?: string | null;
          winner_username?: string | null;
        };
        Update: {
          draw_id?: number | null;
          drawn_at?: string;
          id?: never;
          lottery_id?: string | null;
          prize_gold?: number;
          ticket_number?: number | null;
          winner_user_id?: string | null;
          winner_username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "draw_history_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "lottery_draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "draw_history_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: false;
            referencedRelation: "lottery_games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "draw_history_winner_user_id_fkey";
            columns: ["winner_user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      gold_moves: {
        Row: {
          actor: string | null;
          created_at: string;
          delta: number;
          id: number;
          kind: string;
          note: string | null;
          ref: string | null;
          user_id: string;
        };
        Insert: {
          actor?: string | null;
          created_at?: string;
          delta: number;
          id?: never;
          kind: string;
          note?: string | null;
          ref?: string | null;
          user_id: string;
        };
        Update: {
          actor?: string | null;
          created_at?: string;
          delta?: number;
          id?: never;
          kind?: string;
          note?: string | null;
          ref?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gold_moves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      lottery_admins: {
        Row: {
          added_at: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lottery_draw_secrets: {
        Row: {
          draw_id: number;
          seed: string;
        };
        Insert: {
          draw_id: number;
          seed: string;
        };
        Update: {
          draw_id?: number;
          seed?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_draw_secrets_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: true;
            referencedRelation: "lottery_draws";
            referencedColumns: ["id"];
          },
        ];
      };
      lottery_draws: {
        Row: {
          drawn_at: string | null;
          id: number;
          lottery_id: string;
          opened_at: string;
          seed: string | null;
          seed_hash: string | null;
          status: string;
          ticket_count: number | null;
          tickets_digest: string | null;
          winning_index: number | null;
          winning_ticket: number | null;
        };
        Insert: {
          drawn_at?: string | null;
          id?: never;
          lottery_id: string;
          opened_at?: string;
          seed?: string | null;
          seed_hash?: string | null;
          status?: string;
          ticket_count?: number | null;
          tickets_digest?: string | null;
          winning_index?: number | null;
          winning_ticket?: number | null;
        };
        Update: {
          drawn_at?: string | null;
          id?: never;
          lottery_id?: string;
          opened_at?: string;
          seed?: string | null;
          seed_hash?: string | null;
          status?: string;
          ticket_count?: number | null;
          tickets_digest?: string | null;
          winning_index?: number | null;
          winning_ticket?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_draws_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: false;
            referencedRelation: "lottery_games";
            referencedColumns: ["id"];
          },
        ];
      };
      lottery_games: {
        Row: {
          current_draw_id: number | null;
          default_jackpot: number;
          draw_at: string | null;
          id: string;
          jackpot: number;
          name: string;
          sales_open: boolean;
          ticket_price: number;
          updated_at: string;
        };
        Insert: {
          current_draw_id?: number | null;
          default_jackpot?: number;
          draw_at?: string | null;
          id: string;
          jackpot?: number;
          name: string;
          sales_open?: boolean;
          ticket_price: number;
          updated_at?: string;
        };
        Update: {
          current_draw_id?: number | null;
          default_jackpot?: number;
          draw_at?: string | null;
          id?: string;
          jackpot?: number;
          name?: string;
          sales_open?: boolean;
          ticket_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_games_current_draw_fk";
            columns: ["current_draw_id"];
            isOneToOne: false;
            referencedRelation: "lottery_draws";
            referencedColumns: ["id"];
          },
        ];
      };
      lottery_tickets: {
        Row: {
          created_at: string;
          draw_id: number;
          id: number;
          lottery_id: string;
          price_paid: number;
          purchase_id: number | null;
          ticket_number: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          draw_id: number;
          id?: never;
          lottery_id: string;
          price_paid: number;
          purchase_id?: number | null;
          ticket_number: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          draw_id?: number;
          id?: never;
          lottery_id?: string;
          price_paid?: number;
          purchase_id?: number | null;
          ticket_number?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_tickets_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "lottery_draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lottery_tickets_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: false;
            referencedRelation: "lottery_games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lottery_tickets_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "ticket_purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lottery_tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      player_profiles: {
        Row: {
          created_at: string;
          gold: number;
          user_id: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          gold?: number;
          user_id: string;
          username: string;
        };
        Update: {
          created_at?: string;
          gold?: number;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      ticket_purchases: {
        Row: {
          created_at: string;
          draw_id: number;
          fee: number;
          id: number;
          lottery_id: string;
          price_each: number;
          quantity: number;
          refunded_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          draw_id: number;
          fee: number;
          id?: never;
          lottery_id: string;
          price_each: number;
          quantity: number;
          refunded_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          draw_id?: number;
          fee?: number;
          id?: never;
          lottery_id?: string;
          price_each?: number;
          quantity?: number;
          refunded_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_purchases_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "lottery_draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_purchases_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: false;
            referencedRelation: "lottery_games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_purchases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      withdrawal_requests: {
        Row: {
          amount: number;
          created_at: string;
          id: number;
          processed_at: string | null;
          processed_by: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: never;
          processed_at?: string | null;
          processed_by?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: never;
          processed_at?: string | null;
          processed_by?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_close_and_draw: {
        Args: { p_lottery_id: string };
        Returns: {
          prize_gold: number;
          ticket_number: number;
          winner_username: string;
        }[];
      };
      admin_credit_gold: { Args: { p_amount: number; p_username: string }; Returns: number };
      admin_delete_all_lottery_tickets: { Args: Record<PropertyKey, never>; Returns: number };
      admin_get_fee_earnings: { Args: Record<PropertyKey, never>; Returns: number };
      admin_process_deposit: { Args: { p_approve: boolean; p_request_id: number }; Returns: undefined };
      admin_process_withdrawal: { Args: { p_approve: boolean; p_request_id: number }; Returns: undefined };
      admin_reopen_draw: { Args: { p_lottery_id: string }; Returns: number };
      admin_reset_jackpot_to_ticket_total: { Args: { p_lottery_id: string }; Returns: number };
      admin_reset_lottery_data: { Args: Record<PropertyKey, never>; Returns: undefined };
      admin_set_draw_time: { Args: { p_draw_at: string; p_lottery_id: string }; Returns: undefined };
      admin_set_jackpot: { Args: { p_amount: number; p_lottery_id: string }; Returns: undefined };
      admin_set_sales_open: { Args: { p_lottery_id: string; p_open: boolean }; Returns: undefined };
      admin_set_ticket_price: { Args: { p_lottery_id: string; p_ticket_price: number }; Returns: undefined };
      buy_lottery_tickets: {
        Args: { p_lottery_id: string; p_quantity: number };
        Returns: {
          id: number;
          ticket_number: number;
        }[];
      };
      draw_tickets: {
        Args: { p_draw_id: number };
        Returns: {
          ticket_number: number;
          username: string;
        }[];
      };
      gold_mismatches: {
        Args: Record<PropertyKey, never>;
        Returns: {
          gold: number;
          ledger: number;
          username: string;
        }[];
      };
      is_lottery_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      move_gold: {
        Args: { p_delta: number; p_kind: string; p_note?: string; p_ref?: string; p_user: string };
        Returns: number;
      };
      open_draw: { Args: { p_lottery_id: string }; Returns: number };
      refund_draw: { Args: { p_draw_id: number }; Returns: number };
      request_lottery_deposit: { Args: { p_amount: number }; Returns: number };
      request_lottery_withdrawal: { Args: { p_amount: number }; Returns: number };
      require_lottery_admin: { Args: Record<PropertyKey, never>; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
