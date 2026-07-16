"use client";

import { useCallback, useEffect, useState } from "react";

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setKeys(data.keys);
    } catch {
      setError("Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

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
      <div className="space-y-3">
        {[0, 1].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-recent/30 bg-recent/5 px-4 py-2.5 text-xs text-recent">
          {error}
        </div>
      )}

      {revealedKey && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-xs font-medium text-accent">Your new API key — copy it now, it won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-ink px-3 py-2 font-mono text-xs text-paper">{revealedKey}</code>
            <button
              onClick={copyKey}
              className="shrink-0 rounded-lg border border-accent/30 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/10"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-xs text-muted-light hover:text-paper"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !creating && createKey()}
          placeholder="Key name (e.g. CI pipeline)"
          maxLength={100}
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
        />
        <button
          onClick={createKey}
          disabled={creating}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#b5f34a] disabled:opacity-40"
        >
          {creating ? "Creating..." : "Create key"}
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No API keys yet. Create one to start using the Locus API.</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line-strong">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-paper">{key.name}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                  <code className="font-mono">{key.prefix}...</code>
                  <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                  {key.last_used_at && <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <button
                onClick={() => deleteKey(key.id)}
                className="ml-3 shrink-0 rounded-lg px-3 py-1.5 text-xs text-muted transition hover:bg-recent/10 hover:text-recent"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface/50 p-4">
        <p className="text-xs font-medium text-paper">Quick start</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-ink p-3 font-mono text-xs leading-5 text-muted-light">{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/v1/locate \\
  -H "Authorization: Bearer lk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"repo": "owner/repo", "task": "fix the login bug"}'`}</pre>
      </div>
    </div>
  );
}
