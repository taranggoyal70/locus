"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  repo_url: string;
  task: string;
  slice_files: number;
  total_files: number;
  saved_pct: number;
  created_at: string;
  updated_at: string;
};

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProjects(data.projects);
    } catch {
      setError("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteProject(id: string) {
    try {
      await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError("Failed to delete project.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-recent/30 bg-recent/5 px-4 py-3 text-xs text-recent">
        {error}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-[22px] border border-line bg-surface p-12 text-center">
        <p className="text-sm text-muted">No saved analyses yet.</p>
        <p className="mt-2 text-xs text-muted-light">
          Use the &quot;Save analysis&quot; button in the workspace to keep results here.
        </p>
        <Link
          href="/workspace"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[#b5f34a]"
        >
          Go to workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line-strong">
      {projects.map((project) => (
        <div key={project.id} className="flex items-start justify-between gap-4 px-5 py-4">
          <Link
            href={`/workspace?repo=${encodeURIComponent(project.repo_url)}&task=${encodeURIComponent(project.task)}`}
            className="min-w-0 group"
          >
            <p className="truncate text-sm font-medium text-paper group-hover:text-accent transition">{project.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-light">{project.task}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted">
              <span>{project.slice_files}/{project.total_files} files</span>
              <span>{project.saved_pct}% saved</span>
              <span>{new Date(project.updated_at).toLocaleDateString()}</span>
            </div>
          </Link>
          <button
            onClick={() => deleteProject(project.id)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-muted transition hover:bg-recent/10 hover:text-recent"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
