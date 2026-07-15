import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { buildWorkspacePath, sharedWorkspaceViewFrom } from "@/lib/share";

type DemoProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Keep old demo links safe without exposing a second, public product entry.
export default async function DemoPage({ searchParams }: DemoProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const sharedView = sharedWorkspaceViewFrom(await searchParams);
  redirect(sharedView ? buildWorkspacePath(sharedView) : "/workspace");
}
