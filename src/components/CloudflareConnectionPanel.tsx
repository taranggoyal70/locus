"use client";

import { useEffect, useState } from "react";

import { dangerButton, monoLabel, primaryButton, ruledList, ruledRow, textInput, textLink } from "@/components/controls";
import { InlineError } from "@/components/EmptyState";
import { StateTag } from "@/components/StateTag";

const STEPS = [
  ["Open Cloudflare", "Go to Workers AI and choose “Use REST API.”"],
  ["Copy two values", "Create an API token and copy your Account ID."],
  ["Connect once", "Paste both below. The token is never shown again."],
] as const;

type ConnectionStatus = {
  configured: boolean;
};

export function CloudflareConnectionPanel() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [accountId, setAccountId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/provider-credential", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error ?? "Could not check the connection.");
        setStatus(payload);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not check the connection.");
        }
      });
    return () => controller.abort();
  }, []);

  async function saveConnection() {
    if (saving || !accountId.trim() || !apiToken.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/provider-credential", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, apiToken }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Could not save the connection.");
      setStatus(payload);
      setAccountId("");
      setApiToken("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the connection.");
    } finally {
      setSaving(false);
    }
  }

  async function removeConnection() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/provider-credential", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Could not remove the connection.");
      setStatus(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove the connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-line-2 bg-surface">
      <div className="p-6 sm:p-7">
        <p className="flex flex-wrap items-center justify-between gap-3">
          <span className={monoLabel}>Optional · Bring your own capacity</span>
          <StateTag tone={status?.configured ? "passed" : "neutral"}>
            {status?.configured ? "Connected" : "Not connected"}
          </StateTag>
        </p>
        <h3 className="mt-4 font-display text-[26px] font-normal leading-[1.1] tracking-[-0.012em] text-ink">Connect Cloudflare Workers AI</h3>
        <p className="mt-3 max-w-2xl text-[15px] leading-6 text-ink-2">
          When your account has Agent access, Locus offers one shared Agent Run per day across the
          beta. Connect your own Cloudflare account to avoid waiting for that shared slot.
        </p>

        <ol className={`mt-6 ${ruledList}`}>
          {STEPS.map(([title, body], index) => (
            <li key={title} className={`grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-3 sm:grid-cols-[32px_150px_minmax(0,1fr)] ${ruledRow}`}>
              <span className="font-mono text-[11px] leading-6 text-muted tabular-nums">0{index + 1}</span>
              <span className="text-[14px] font-medium leading-6 text-ink">{title}</span>
              <span className="col-start-2 text-[14px] leading-6 text-ink-2 sm:col-start-auto">{body}</span>
            </li>
          ))}
        </ol>

        <a
          href="https://dash.cloudflare.com/?to=/:account/ai/workers-ai"
          target="_blank"
          rel="noreferrer"
          className={`mt-5 inline-flex items-center gap-1.5 text-[14px] ${textLink}`}
        >
          Open Cloudflare Workers AI <span aria-hidden>↗</span>
        </a>
      </div>

      <div className="space-y-5 border-t border-line bg-canvas-2/60 p-6 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-ink">
            Cloudflare Account ID
            <input
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="32-character Account ID"
              className={`mt-2 font-mono text-[13px] ${textInput}`}
            />
          </label>
          <label className="block text-[13px] font-medium text-ink">
            Workers AI API token
            <input
              type="password"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              autoComplete="new-password"
              placeholder="Paste token once"
              className={`mt-2 font-mono text-[13px] ${textInput}`}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            type="button"
            onClick={saveConnection}
            disabled={saving || !accountId.trim() || !apiToken.trim()}
            className={primaryButton}
          >
            {saving ? "Saving…" : status?.configured ? "Replace connection" : "Connect Cloudflare"}
          </button>
          {status?.configured && (
            <button
              type="button"
              onClick={removeConnection}
              disabled={saving}
              className={dangerButton}
            >
              Remove connection
            </button>
          )}
          <p className="text-[13px] leading-5 text-muted">
            Encrypted before storage. Used only for your Agent Runs. Remove it anytime.
          </p>
        </div>
        {error && <InlineError>{error}</InlineError>}
      </div>
    </div>
  );
}
