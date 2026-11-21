"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  repo_url: string;
  task: string;
  slice_files: number;
  total_files: number;
  created_at: string;
  updated_at: string;
};

async function fetchProjects(signal?: AbortSignal): Promise<Project[]> {
  const response = await fetch("/api/projects", { signal });
  if (!response.ok) throw new Error("Projects request failed.");
  const data = await response.json();
  return data.projects;
}

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchProjects(controller.signal)
      .then((nextProjects) => setProjects(nextProjects))
      .catch(() => {
        if (!controller.signal.aborted) setError("Failed to load projects.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

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
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full rounded-card" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-chip border border-failed/30 bg-failed/5 px-4 py-3 text-xs text-failed">
        {error}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-12 text-center">
        <p className="text-sm text-muted">No saved analyses yet.</p>
        <p className="mt-2 text-xs text-ink-2">
          Use the &quot;Save analysis&quot; button in the workspace to keep results here.
        </p>
        <Link
          href="/workspace"
          className="mt-4 inline-block rounded-chip bg-ink px-4 py-2 text-sm font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.97]"
        >
          Go to workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-line overflow-hidden rounded-card border border-line-2">
      {projects.map((project) => (
        <div key={project.id} className="flex items-start justify-between gap-4 px-5 py-4">
          <Link
            href={`/workspace?repo=${encodeURIComponent(project.repo_url)}&task=${encodeURIComponent(project.task)}`}
            className="min-w-0 group"
          >
            <p className="truncate text-sm font-medium text-ink group-hover:text-ink transition">{project.name}</p>
            <p className="mt-0.5 truncate text-xs text-ink-2">{project.task}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted">
              <span>{project.slice_files}/{project.total_files} files</span>
              <span>{project.total_files > 0 ? Math.round((project.slice_files / project.total_files) * 100) : 0}% included</span>
              <span>{new Date(project.updated_at).toLocaleDateString()}</span>
            </div>
          </Link>
          <button
            onClick={() => deleteProject(project.id)}
            className="shrink-0 rounded-chip px-2.5 py-1.5 text-xs text-muted transition hover:bg-failed/10 hover:text-failed"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
