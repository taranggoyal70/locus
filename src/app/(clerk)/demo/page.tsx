import { redirect } from "next/navigation";

import { buildWorkspacePath, sharedWorkspaceViewFrom } from "@/lib/share";

type DemoProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Keep old demo links useful by sending them through the public early-access
// workspace. Workspace authentication preserves the requested deep link.
export default async function DemoPage({ searchParams }: DemoProps) {
  const sharedView = sharedWorkspaceViewFrom(await searchParams);
  redirect(sharedView ? buildWorkspacePath(sharedView) : "/workspace");
}
