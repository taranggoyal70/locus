export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  repo_url: string;
  task: string;
  slice_files: number;
  total_files: number;
  saved_pct: number;
  team_id: string | null;
  created_at: string;
  updated_at: string;
};

type ApiKeyRow = {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  user_id: string | null;
  event: string;
  properties: Json;
  created_at: string;
};

type GitHubConnectionRow = {
  id: string;
  user_id: string;
  github_username: string;
  access_token: string;
  scopes: string;
  created_at: string;
  updated_at: string;
};

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

type TeamMemberRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type WaitlistRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  use_case: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: ProjectRow;
        Insert: Omit<ProjectRow, "id" | "created_at" | "updated_at" | "team_id"> & { team_id?: string | null };
        Update: Partial<Omit<ProjectRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      api_keys: {
        Row: ApiKeyRow;
        Insert: Omit<ApiKeyRow, "id" | "created_at" | "last_used_at"> & { last_used_at?: string | null };
        Update: Partial<Omit<ApiKeyRow, "id" | "created_at">>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: Omit<EventRow, "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      github_connections: {
        Row: GitHubConnectionRow;
        Insert: Omit<GitHubConnectionRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<GitHubConnectionRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      teams: {
        Row: TeamRow;
        Insert: Omit<TeamRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<TeamRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      team_members: {
        Row: TeamMemberRow;
        Insert: Omit<TeamMemberRow, "id" | "created_at"> & { role?: string };
        Update: Partial<Omit<TeamMemberRow, "id" | "created_at">>;
        Relationships: [];
      };
      waitlist: {
        Row: WaitlistRow;
        Insert: Omit<WaitlistRow, "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
