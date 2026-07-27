"use client";

import { useEffect, useState } from "react";

type UsageData = {
  totalEvents: number;
  byType: Record<string, number>;
  projectCount: number;
  keyCount: number;
};

export function UsageStats() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/usage", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((nextData) => {
        if (nextData) setData(nextData);
      })
      .catch(() => {
        // Usage analytics are non-critical.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { label: "API calls (30d)", value: data.byType["api_locate"] ?? 0 },
    { label: "Repos loaded (30d)", value: data.byType["repo_loaded"] ?? 0 },
    { label: "Saved analyses", value: data.projectCount },
    { label: "API keys", value: data.keyCount },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-line-strong bg-surface/50 px-4 py-3">
          <p className="font-mono text-2xl font-semibold tracking-[-0.03em] text-paper">{stat.value}</p>
          <p className="mt-1 text-xs text-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
