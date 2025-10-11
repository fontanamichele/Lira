export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string | null;
          main_currency: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname?: string | null;
          main_currency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nickname?: string | null;
          main_currency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      account_balances: {
        Row: {
          id: string;
          account_id: string;
          category: "currency" | "stock" | "etf" | "crypto";
          currency: string;
          current_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          category?: "currency" | "stock" | "etf" | "crypto";
          currency: string;
          current_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          category?: "currency" | "stock" | "etf" | "crypto";
          currency?: string;
          current_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          account_balance_id: string;
          type: "income" | "expense" | "transfer" | "taxation";
          amount: number;
          currency: string;
          description: string | null;
          category: string | null;
          date: string;
          to_account_id: string | null;
          to_account_balance_id: string | null;
          to_amount: number | null;
          to_currency: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          account_balance_id: string;
          type: "income" | "expense" | "transfer" | "taxation";
          amount: number;
          currency: string;
          description?: string | null;
          category?: string | null;
          date: string;
          to_account_id?: string | null;
          to_account_balance_id?: string | null;
          to_amount?: number | null;
          to_currency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          account_balance_id?: string;
          type?: "income" | "expense" | "transfer" | "taxation";
          amount?: number;
          currency?: string;
          description?: string | null;
          category?: string | null;
          date?: string;
          to_account_id?: string | null;
          to_account_balance_id?: string | null;
          to_amount?: number | null;
          to_currency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
