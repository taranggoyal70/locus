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
  token_budget: number;
  cost_microusd: number;
  included_files: string[];
  excluded_files: string[];
  widened_files: string[];
  failure_kind: string | null;
  proposal_hash: string | null;
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
  content_sha256: string | null;
  base_revision: string | null;
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

type AgentReviewRow = {
  id: string;
  run_id: string;
  user_id: string;
  proposal_hash: string;
  decision: string;
  criterion_decisions: Json;
  note: string | null;
  created_at: string;
};

type AgentProviderLeaseRow = {
  run_id: string;
  model: string;
  acquired_at: string;
  released_at: string | null;
  expires_at: string;
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
          | "token_budget"
          | "cost_microusd"
          | "included_files"
          | "excluded_files"
          | "widened_files"
          | "failure_kind"
          | "proposal_hash"
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
        Insert: Omit<
          AgentArtifactRow,
          "id" | "created_at" | "url" | "content" | "content_sha256" | "base_revision"
        > & {
          url?: string | null;
          content?: string | null;
          content_sha256?: string | null;
          base_revision?: string | null;
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
      agent_reviews: {
        Row: AgentReviewRow;
        Insert: Omit<AgentReviewRow, "id" | "created_at" | "note"> & {
          note?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      agent_provider_leases: {
        Row: AgentProviderLeaseRow;
        Insert: Omit<AgentProviderLeaseRow, "acquired_at" | "released_at"> & {
          acquired_at?: string;
          released_at?: string | null;
        };
        Update: Partial<Pick<AgentProviderLeaseRow, "released_at" | "expires_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_api_rate_limit: {
        Args: {
          p_bucket: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: Array<{
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
        }>;
      };
      publish_agent_proposal: {
        Args: {
          p_run_id: string;
          p_user_id: string;
          p_base_revision: string;
          p_change_set: string;
          p_diff: string;
          p_summary: string;
          p_tool_detail: Json;
          p_verify_detail: Json;
          p_included_context_tokens: number;
          p_input_tokens: number;
          p_cached_input_tokens: number;
          p_output_tokens: number;
          p_widened_files: string[];
          p_excluded_files: string[];
        };
        Returns: Array<{ proposal_hash: string }>;
      };
      decide_agent_proposal: {
        Args: {
          p_run_id: string;
          p_user_id: string;
          p_proposal_hash: string;
          p_decision: string;
          p_criterion_decisions: Json;
          p_note?: string | null;
        };
        Returns: Array<{ run_status: string; review_id: string }>;
      };
      acquire_agent_provider_lease: {
        Args: {
          p_run_id: string;
          p_model: string;
          p_max_concurrent?: number;
          p_lease_seconds?: number;
        };
        Returns: Array<{ allowed: boolean; retry_after_seconds: number }>;
      };
      release_agent_provider_lease: {
        Args: {
          p_run_id: string;
          p_cooldown_seconds?: number;
        };
        Returns: boolean;
      };
      // R12: counts a user's active and daily Runs and inserts the Run in one
      // transaction. `reason` is null when the claim was allowed.
      claim_agent_run_slot: {
        Args: {
          p_user_id: string;
          p_task_id: string;
          p_model: string;
          p_token_budget: number;
          p_active_statuses: string[];
          p_max_active: number;
          p_max_daily: number;
        };
        Returns: Array<{ allowed: boolean; reason: string | null; run_id: string | null }>;
      };
      delete_expired_agent_data: {
        Args: { p_retention_days?: number };
        Returns: Array<{
          deleted_runs: number;
          deleted_tasks: number;
          deleted_events: number;
          deleted_waitlist_entries: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
