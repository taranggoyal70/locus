"use client";

import { useEffect, useMemo, useState } from "react";

import { monoLabel, monoMeta, primaryButton, rowAction, ruledList, ruledRow, secondaryButton, shortDate, textInput } from "@/components/controls";
import { InlineError } from "@/components/EmptyState";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
};

async function fetchApiKeys(signal?: AbortSignal): Promise<ApiKey[]> {
  const response = await fetch("/api/keys", { signal });
  if (!response.ok) throw new Error("API key request failed.");
  const data = await response.json();
  return data.keys;
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"), []);

  async function loadKeys() {
    try {
      setKeys(await fetchApiKeys());
    } catch {
      setError("Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetchApiKeys(controller.signal)
      .then((nextKeys) => setKeys(nextKeys))
      .catch(() => {
        if (!controller.signal.aborted) setError("Failed to load API keys.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function createKey() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setRevealedKey(data.key);
      setNewKeyName("");
      await loadKeys();
    } catch {
      setError("Failed to create key.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: string) {
    try {
      await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      setError("Failed to delete key.");
    }
  }

  async function copyKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
  }

  if (loading) {
    return (
      <div className={ruledList}>
        {[0, 1].map((i) => (
          <div key={i} className={`py-4 ${ruledRow}`}>
            <div className="skeleton h-4 w-28 rounded-chip" />
            <div className="skeleton mt-2.5 h-4 w-48 rounded-chip" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <InlineError>{error}</InlineError>}

      {revealedKey && (
        <div className="rounded-card border border-passed/50 bg-surface p-5">
          <p className="text-[14px] font-medium text-passed">Your new API key. Copy it now; it won&apos;t be shown again.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="h-10 min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-chip border border-line-2 bg-canvas px-3 font-mono text-[13px] leading-10 text-ink" tabIndex={0}>{revealedKey}</code>
            <button type="button" onClick={copyKey} className={secondaryButton}>
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRevealedKey(null)}
            className="mt-3 text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <label htmlFor="api-key-name" className="sr-only">Key name</label>
        <input
          id="api-key-name"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !creating && createKey()}
          placeholder="Key name (e.g. CI pipeline)"
          maxLength={100}
          className={`flex-1 ${textInput}`}
        />
        <button
          type="button"
          onClick={createKey}
          disabled={creating}
          className={primaryButton}
        >
          {creating ? "Creating..." : "Create key"}
        </button>
      </div>

      {keys.length === 0 && error ? (
        // A failed load is not an empty list. Showing "no keys yet" to someone
        // whose keys simply did not load invites them to create a duplicate, and
        // for a credentials panel that is the wrong thing to be wrong about.
        <p className="border-t border-ink pt-4 text-[14px] leading-6 text-muted">
          Your existing keys could not be loaded, so none are shown. Reload before creating a new one.
        </p>
      ) : keys.length === 0 ? (
        <p className="border-t border-ink pt-4 text-[14px] leading-6 text-muted">No API keys yet. Create one to start using the Locus API.</p>
      ) : (
        <ul className={ruledList}>
          {keys.map((key) => (
            <li key={key.id} className={`flex items-center justify-between gap-4 py-3.5 ${ruledRow}`}>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-ink">{key.name}</p>
                <p className={`mt-1 flex flex-wrap gap-x-4 gap-y-0.5 ${monoMeta}`}>
                  <code className="text-ink-2">{key.prefix}...</code>
                  <span>Created {shortDate(key.created_at)}</span>
                  {key.last_used_at && <span>Last used {shortDate(key.last_used_at)}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteKey(key.id)}
                aria-label={`Revoke ${key.name}`}
                className={rowAction}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-hidden rounded-card border border-line-2">
        <p className={`border-b border-line bg-canvas-2 px-4 py-2.5 ${monoLabel}`}>Quick start</p>
        <pre className="overflow-x-auto bg-surface p-4 font-mono text-[12px] leading-5 text-ink-2" tabIndex={0}>{`curl -X POST ${origin}/api/v1/locate \\
  -H "Authorization: Bearer lk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"repo": "owner/repo", "task": "fix the login bug"}'`}</pre>
      </div>
    </div>
  );
}
