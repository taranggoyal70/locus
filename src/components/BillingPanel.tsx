"use client";

import { useCallback, useEffect, useState } from "react";

type BillingStatus = {
  plan: string;
  status: string;
  subscribedAt?: string;
};

export function BillingPanel() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/status");
      if (!res.ok) throw new Error();
      setBilling(await res.json());
    } catch {
      setError("Failed to load billing status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBilling(); }, [loadBilling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      loadBilling();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadBilling]);

  async function checkout() {
    setRedirecting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setRedirecting(false); return; }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Failed to start checkout.");
      setRedirecting(false);
    }
  }

  async function openPortal() {
    setRedirecting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setRedirecting(false); return; }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Failed to open billing portal.");
      setRedirecting(false);
    }
  }

  if (loading) {
    return <div className="skeleton h-20 w-full rounded-xl" />;
  }

  const isPro = billing?.plan === "pro" && billing?.status === "active";

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-recent/30 bg-recent/5 px-4 py-2.5 text-xs text-recent">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-line-strong px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${isPro ? "bg-accent" : "bg-muted"}`} />
            <p className="text-sm font-medium text-paper">
              {isPro ? "Pro" : "Free"} plan
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {isPro
              ? `Active since ${new Date(billing!.subscribedAt!).toLocaleDateString()}`
              : "Upgrade for private repos, team workspaces, and higher limits"}
          </p>
        </div>
        {isPro ? (
          <button
            onClick={openPortal}
            disabled={redirecting}
            className="ml-3 shrink-0 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-paper transition hover:border-accent/40 disabled:opacity-40"
          >
            {redirecting ? "Opening..." : "Manage subscription"}
          </button>
        ) : (
          <button
            onClick={checkout}
            disabled={redirecting}
            className="ml-3 shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[#b5f34a] disabled:opacity-40"
          >
            {redirecting ? "Redirecting..." : "Upgrade to Pro"}
          </button>
        )}
      </div>
    </div>
  );
}
