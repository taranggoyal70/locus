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

type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type AgentTaskRow = {
  id: string;
  user_id: string;
  repo_url: string;
  base_ref: string;
  task: string;
  acceptance_criteria: string[];
  created_at: string;
  updated_at: string;
};

type AgentRunRow = {
  id: string;
  task_id: string;
  user_id: string;
  status: string;
  model: string;
  workflow_run_id: string | null;
  sandbox_id: string | null;
  branch_name: string | null;
  baseline_tokens: number;
  included_context_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  cost_microusd: number;
  included_files: string[];
  excluded_files: string[];
  widened_files: string[];
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type AgentStepRow = {
  id: number;
  run_id: string;
  user_id: string;
  sequence: number;
  kind: string;
  status: string;
  title: string;
  detail: Json;
  input_tokens: number;
  output_tokens: number;
  started_at: string;
  completed_at: string | null;
};

type AgentArtifactRow = {
  id: string;
  run_id: string;
  user_id: string;
  kind: string;
  label: string;
  url: string | null;
  content: string | null;
  created_at: string;
};

type AgentApprovalRow = {
  id: string;
  run_id: string;
  user_id: string;
  action: string;
  status: string;
  payload: Json;
  expires_at: string | null;
  decided_at: string | null;
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
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Omit<SubscriptionRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SubscriptionRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      agent_tasks: {
        Row: AgentTaskRow;
        Insert: Omit<AgentTaskRow, "id" | "created_at" | "updated_at" | "base_ref" | "acceptance_criteria"> & {
          base_ref?: string;
          acceptance_criteria?: string[];
        };
        Update: Partial<Omit<AgentTaskRow, "id" | "user_id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      agent_runs: {
        Row: AgentRunRow;
        Insert: Omit<
          AgentRunRow,
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "workflow_run_id"
          | "sandbox_id"
          | "branch_name"
          | "baseline_tokens"
          | "included_context_tokens"
          | "input_tokens"
          | "output_tokens"
          | "cached_input_tokens"
          | "cost_microusd"
          | "included_files"
          | "excluded_files"
          | "widened_files"
          | "error"
          | "started_at"
          | "completed_at"
        > & Partial<Omit<AgentRunRow, "id" | "task_id" | "user_id" | "model" | "created_at" | "updated_at">>;
        Update: Partial<Omit<AgentRunRow, "id" | "task_id" | "user_id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      agent_steps: {
        Row: AgentStepRow;
        Insert: Omit<
          AgentStepRow,
          "id" | "detail" | "input_tokens" | "output_tokens" | "started_at" | "completed_at"
        > & Partial<Pick<AgentStepRow, "detail" | "input_tokens" | "output_tokens" | "started_at" | "completed_at">>;
        Update: Partial<Omit<AgentStepRow, "id" | "run_id" | "user_id" | "sequence">>;
        Relationships: [];
      };
      agent_artifacts: {
        Row: AgentArtifactRow;
        Insert: Omit<AgentArtifactRow, "id" | "created_at" | "url" | "content"> & {
          url?: string | null;
          content?: string | null;
        };
        Update: Partial<Omit<AgentArtifactRow, "id" | "run_id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      agent_approvals: {
        Row: AgentApprovalRow;
        Insert: Omit<
          AgentApprovalRow,
          "id" | "created_at" | "status" | "payload" | "expires_at" | "decided_at"
        > & Partial<Pick<AgentApprovalRow, "status" | "payload" | "expires_at" | "decided_at">>;
        Update: Partial<Omit<AgentApprovalRow, "id" | "run_id" | "user_id" | "action" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
