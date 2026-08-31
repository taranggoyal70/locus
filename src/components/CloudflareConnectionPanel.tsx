"use client";

import { useEffect, useState } from "react";

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
    <div className="overflow-hidden rounded-2xl border border-line-strong bg-surface">
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-accent">
              Optional · Bring your own capacity
            </p>
            <h3 className="mt-1 text-base font-semibold text-paper">Connect Cloudflare Workers AI</h3>
          </div>
          <span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
            status?.configured
              ? "border-accent/35 bg-accent/10 text-accent"
              : "border-line-strong text-muted"
          }`}>
            {status?.configured ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-light">
          When your account has Agent access, Locus offers one shared Agent Run per day across the
          beta. Connect your own Cloudflare account to avoid waiting for that shared slot.
        </p>
      </div>

      <div className="space-y-5 p-5">
        <ol className="grid gap-3 text-xs leading-5 text-muted-light sm:grid-cols-3">
          <li className="rounded-xl border border-line p-3"><strong className="block text-paper">1. Open Cloudflare</strong>Go to Workers AI and choose “Use REST API.”</li>
          <li className="rounded-xl border border-line p-3"><strong className="block text-paper">2. Copy two values</strong>Create an API token and copy your Account ID.</li>
          <li className="rounded-xl border border-line p-3"><strong className="block text-paper">3. Connect once</strong>Paste both below. The token is never shown again.</li>
        </ol>

        <a
          href="https://dash.cloudflare.com/?to=/:account/ai/workers-ai"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
        >
          Open Cloudflare Workers AI <span aria-hidden>↗</span>
        </a>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-paper">
            Cloudflare Account ID
            <input
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="32-character Account ID"
              className="mt-2 w-full rounded-xl border border-line-strong bg-ink px-3 py-3 font-mono text-xs text-paper placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-paper">
            Workers AI API token
            <input
              type="password"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              autoComplete="new-password"
              placeholder="Paste token once"
              className="mt-2 w-full rounded-xl border border-line-strong bg-ink px-3 py-3 font-mono text-xs text-paper placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveConnection}
            disabled={saving || !accountId.trim() || !apiToken.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : status?.configured ? "Replace connection" : "Connect Cloudflare"}
          </button>
          {status?.configured && (
            <button
              type="button"
              onClick={removeConnection}
              disabled={saving}
              className="rounded-xl border border-recent/35 px-4 py-2.5 text-sm font-semibold text-recent disabled:opacity-40"
            >
              Remove connection
            </button>
          )}
          <p className="text-[10px] leading-4 text-muted">
            Encrypted before storage. Used only for your Agent Runs. Remove it anytime.
          </p>
        </div>
        {error && <p role="alert" className="text-xs text-recent">{error}</p>}
      </div>
    </div>
  );
}
