import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocusApp } from "@/components/LocusApp";

export default async function WorkspacePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const accountName = user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0];

  return (
    <ErrorBoundary>
      <LocusApp accountName={accountName} isWorkspace />
    </ErrorBoundary>
  );
}
