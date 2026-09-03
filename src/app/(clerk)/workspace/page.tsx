import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocusApp } from "@/components/LocusApp";
import { admissionForAccount } from "@/lib/admission-server";

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
  // Resolved alongside the Clerk profile rather than after it. Both are
  // independent reads on the render path of the product's main screen, and
  // awaiting them in sequence would add a database round trip to every load.
  const [user, admission] = await Promise.all([
    currentUser(),
    admissionForAccount(userId),
  ]);
  const accountName = user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0];

  return (
    <ErrorBoundary>
      <LocusApp
        accountName={accountName}
        isWorkspace
        initialRunId={initialRunId}
        canStartRun={admission.capabilities.runStart}
      />
    </ErrorBoundary>
  );
}
