"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { monoMeta, primaryButton, rowAction, ruledList, ruledRow, shortDate } from "@/components/controls";
import { EmptyState, InlineError } from "@/components/EmptyState";

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
      <div className={ruledList}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`py-4 ${ruledRow}`}>
            <div className="skeleton h-4 w-32 rounded-chip" />
            <div className="skeleton mt-2.5 h-4 w-3/5 rounded-chip" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <InlineError className="border-t border-ink pt-5">{error}</InlineError>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No saved analyses yet."
        action={<Link href="/workspace" className={primaryButton}>Go to workspace</Link>}
      >
        Use the &quot;Save analysis&quot; button in the workspace to keep results here.
      </EmptyState>
    );
  }

  return (
    <ul className={ruledList}>
      {projects.map((project) => (
        <li key={project.id} className={`flex items-start justify-between gap-4 ${ruledRow}`}>
          <Link
            href={`/workspace?repo=${encodeURIComponent(project.repo_url)}&task=${encodeURIComponent(project.task)}`}
            className="group min-w-0 flex-1 py-4"
          >
            <p className="truncate text-[15px] font-medium text-ink underline decoration-transparent underline-offset-[5px] transition-colors duration-150 group-hover:decoration-line-2">{project.name}</p>
            <p className="mt-0.5 truncate text-[14px] text-ink-2">{project.task}</p>
            <p className={`mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 ${monoMeta}`}>
              <span><span className="text-included-ink">{project.slice_files}</span> / {project.total_files} files</span>
              <span>{project.total_files > 0 ? Math.round((project.slice_files / project.total_files) * 100) : 0}% included</span>
              <span>{shortDate(project.updated_at)}</span>
            </p>
          </Link>
          <button
            type="button"
            onClick={() => deleteProject(project.id)}
            aria-label={`Delete ${project.name}`}
            className={`mt-3 ${rowAction}`}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
