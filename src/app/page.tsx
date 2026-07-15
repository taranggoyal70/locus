import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const repo = typeof params.repo === "string" ? params.repo : undefined;
  const task = typeof params.task === "string" ? params.task : undefined;

  // Preserve launch links that point to a specific reproducible public replay.
  if (repo && task) {
    const query = new URLSearchParams({ repo, task });
    redirect(`/demo?${query.toString()}`);
  }

  const { userId } = await auth();
  redirect(userId ? "/workspace" : "/sign-in");
}
