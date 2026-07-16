export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          repo_url: string;
          task: string;
          slice_files: number;
          total_files: number;
          saved_pct: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["projects"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          key_hash: string;
          prefix: string;
          last_used_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["api_keys"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["api_keys"]["Insert"]>;
      };
      events: {
        Row: {
          id: string;
          user_id: string | null;
          event: string;
          properties: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["events"]["Row"], "id" | "created_at">;
        Update: never;
      };
    };
  };
};
