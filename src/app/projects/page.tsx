import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ProjectsList } from "@/components/ProjectsList";
import { SettingsShell } from "@/components/SettingsShell";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <SettingsShell>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-paper">Saved tasks</h1>
      <p className="mt-1 text-sm text-muted-light">
        Repository and task references saved from the workspace. Opening one runs a fresh analysis against the current repository state.
      </p>
      <div className="mt-6">
        <ProjectsList />
      </div>
    </SettingsShell>
  );
}
