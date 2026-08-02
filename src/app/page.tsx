import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { LandingPage } from "@/components/LandingPage";
import { buildWorkspacePath, sharedWorkspaceViewFrom } from "@/lib/share";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { userId } = await auth();
  const params = await searchParams;
  const sharedView = sharedWorkspaceViewFrom(params);

  if (userId) {
    if (sharedView) redirect(buildWorkspacePath(sharedView));
    redirect("/workspace");
  }

  return <LandingPage />;
}
