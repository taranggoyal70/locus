import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocusApp } from "@/components/LocusApp";
import { alphaCapabilitiesForUser } from "@/lib/alpha-capabilities";

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
  const user = await currentUser();
  const accountName = user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0];
  const capabilities = alphaCapabilitiesForUser(userId);

  return (
    <ErrorBoundary>
      <LocusApp
        accountName={accountName}
        isWorkspace
        initialRunId={initialRunId}
        canStartRun={capabilities.runStart}
      />
    </ErrorBoundary>
  );
}
