"use client";

import { useCallback, useEffect, useState } from "react";

type ConnectionStatus = {
  connected: boolean;
  username?: string;
  scopes?: string;
  connectedAt?: string;
};

export function GitHubConnectionPanel() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/github/status");
      if (!res.ok) throw new Error();
      setStatus(await res.json());
    } catch {
      setError("Failed to load GitHub connection status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      loadStatus();
      window.history.replaceState({}, "", window.location.pathname);
    }
    const ghError = params.get("error");
    if (ghError?.startsWith("github_")) {
      const messages: Record<string, string> = {
        github_missing_code: "GitHub did not return an authorization code.",
        github_state_mismatch: "Session mismatch — try connecting again.",
        github_expired: "Authorization expired — try connecting again.",
        github_invalid_state: "Invalid authorization state.",
        github_not_configured: "GitHub OAuth is not configured on this server.",
        github_token_failed: "Failed to exchange code for a token.",
        github_no_token: "GitHub did not return an access token.",
      };
      setError(messages[ghError] ?? "GitHub connection failed.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadStatus]);

  async function disconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/github/status", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setStatus({ connected: false });
    } catch {
      setError("Failed to disconnect GitHub.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return <div className="skeleton h-20 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-recent/30 bg-recent/5 px-4 py-2.5 text-xs text-recent">
          {error}
        </div>
      )}

      {status?.connected ? (
        <div className="flex items-center justify-between rounded-xl border border-line-strong px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              <p className="text-sm font-medium text-paper">Connected as {status.username}</p>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Connected {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : "recently"}
              {status.scopes ? ` · Scopes: ${status.scopes}` : ""}
            </p>
          </div>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="ml-3 shrink-0 rounded-lg px-3 py-1.5 text-xs text-muted transition hover:bg-recent/10 hover:text-recent disabled:opacity-40"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-line-strong p-4">
          <p className="text-sm text-muted-light">
            Connect your GitHub account to analyze private repositories.
            Locus requests <code className="rounded bg-ink px-1.5 py-0.5 font-mono text-xs">repo</code> scope
            to read your repository contents.
          </p>
          <a
            href="/api/github/connect"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper/90"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Connect GitHub
          </a>
        </div>
      )}
    </div>
  );
}
