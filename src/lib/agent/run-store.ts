import type { Database, Json } from "@/lib/database.types";
import {
  assertRunTransition,
  isRunStatus,
  isTerminalRun,
  type RunStatus,
} from "@/lib/agent/run-state";
import { serviceClient } from "@/lib/supabase";

type RunUpdate = Database["public"]["Tables"]["agent_runs"]["Update"];

export async function transitionRun(input: {
  runId: string;
  userId: string;
  current: RunStatus;
  next: RunStatus;
  values?: Omit<RunUpdate, "status">;
}): Promise<void> {
  assertRunTransition(input.current, input.next);
  const db = serviceClient();
  const { data, error } = await db
    .from("agent_runs")
    .update({ ...input.values, status: input.next })
    .eq("id", input.runId)
    .eq("user_id", input.userId)
    .eq("status", input.current)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Run could not transition from ${input.current} to ${input.next}`);
  }
}

export async function patchRun(input: {
  runId: string;
  userId: string;
  current: RunStatus;
  values: Omit<RunUpdate, "status">;
}): Promise<void> {
  if (isTerminalRun(input.current)) throw new Error("Terminal Runs cannot be rewritten");
  const db = serviceClient();
  const { data, error } = await db
    .from("agent_runs")
    .update(input.values)
    .eq("id", input.runId)
    .eq("user_id", input.userId)
    .eq("status", input.current)
    .select("id")
    .single();
  if (error || !data) throw new Error(`Run is no longer ${input.current}`);
}

export async function appendRunStep(input: {
  runId: string;
  userId: string;
  sequence: number;
  kind: "localize" | "plan" | "tool" | "widen" | "verify" | "approval" | "delivery";
  status: "completed" | "failed" | "skipped";
  title: string;
  detail?: Json;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  const db = serviceClient();
  const { error } = await db.from("agent_steps").insert({
    run_id: input.runId,
    user_id: input.userId,
    sequence: input.sequence,
    kind: input.kind,
    status: input.status,
    title: input.title,
    detail: input.detail ?? {},
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    completed_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not append Run Step: ${error.message}`);
}

export async function failRun(runId: string, message: string): Promise<void> {
  const db = serviceClient();
  const { data: run, error } = await db
    .from("agent_runs")
    .select("user_id,status")
    .eq("id", runId)
    .single();
  if (error || !run || !isRunStatus(run.status)) return;
  if (isTerminalRun(run.status)) return;
  await transitionRun({
    runId,
    userId: run.user_id,
    current: run.status,
    next: "failed",
    values: {
      error: message.slice(0, 2_000),
      completed_at: new Date().toISOString(),
    },
  });
}
