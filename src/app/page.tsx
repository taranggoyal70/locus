import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { buildWorkspacePath, sharedWorkspaceViewFrom } from "@/lib/share";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;
  const sharedView = sharedWorkspaceViewFrom(params);

  // Preserve old launch links, but only inside the authenticated workspace.
  if (sharedView) redirect(buildWorkspacePath(sharedView));

  redirect("/workspace");
}
