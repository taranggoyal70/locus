"use client";

import { useEffect, useState } from "react";

import { InlineError } from "@/components/EmptyState";

type UsageData = {
  totalEvents: number;
  byType: Record<string, number>;
  projectCount: number;
  keyCount: number;
};

/** The public evidence strip: serif figures in a ruled row under an ink rule. */
const strip = "grid grid-cols-2 border-t border-ink sm:grid-cols-4";
const cell = "border-b border-line py-5 pr-4 max-sm:even:border-l max-sm:even:pl-4 sm:border-b-0 sm:px-5 sm:first:pl-0 sm:[&:not(:first-child)]:border-l";

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
      <div className={strip}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cell}>
            <div className="skeleton h-10 w-14 rounded-chip" />
            <div className="skeleton mt-3 h-4 w-24 rounded-chip" />
          </div>
        ))}
      </div>
    );
  }

  // Returning null left the Settings page with a "Usage" heading, its
  // description, and then a hole. Analytics being non-critical is a reason not to
  // block the page, not a reason to render nothing under a heading that promises
  // something.
  if (!data) {
    return (
      <InlineError className="border-t border-ink pt-5">
        Usage could not be loaded. Your Runs and API activity are unaffected.
      </InlineError>
    );
  }

  const stats = [
    { label: "API calls (30d)", value: data.byType["api_locate"] ?? 0 },
    { label: "Repos loaded (30d)", value: data.byType["repo_loaded"] ?? 0 },
    { label: "Saved analyses", value: data.projectCount },
    { label: "API keys", value: data.keyCount },
  ];

  return (
    <dl className={strip}>
      {stats.map((stat) => (
        <div key={stat.label} className={`flex flex-col-reverse ${cell}`}>
          <dt className="mt-2 text-[13px] leading-5 text-ink-2">{stat.label}</dt>
          <dd className="font-display text-[44px] font-normal leading-none tracking-[-0.02em] text-ink tabular-nums">{stat.value.toLocaleString("en-US")}</dd>
        </div>
      ))}
    </dl>
  );
}
