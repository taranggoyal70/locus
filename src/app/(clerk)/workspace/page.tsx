import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocusApp } from "@/components/LocusApp";
import { admitOnFirstUse } from "@/lib/admission-server";
import { readRunUsage } from "@/lib/agent/run-usage";
import { runAccessFromAdmission } from "@/lib/run-access";

export const metadata: Metadata = {
  title: "Workspace · Locus",
};

type WorkspacePageProps = {
  searchParams: Promise<{ run?: string | string[] }>;
};

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;
  const requestedRunId = Array.isArray(params.run) ? params.run[0] : params.run;
  const initialRunId = requestedRunId && /^[0-9a-f-]{36}$/i.test(requestedRunId)
    ? requestedRunId
    : null;
  // The account button in the header shows who is signed in, so the workspace
  // no longer reads the Clerk profile for a name of its own.
  const admission = await admitOnFirstUse(userId);

  // Read only for an account that can actually start a Run. For everyone else
  // these are two count queries spent on a number no surface displays.
  //
  // A failure degrades to null rather than to an error page: the counts decide
  // what the panel says about the allowance, not whether a Run is permitted, and
  // `claim_agent_run_slot` remains the authority either way.
  let usage = null;
  if (admission.capabilities.runStart) {
    try {
      usage = await readRunUsage(userId);
    } catch {
      usage = null;
    }
  }

  return (
    <ErrorBoundary>
      <LocusApp
        isWorkspace
        initialRunId={initialRunId}
        runAccess={runAccessFromAdmission(admission, usage)}
      />
    </ErrorBoundary>
  );
}
