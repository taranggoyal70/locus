"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
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
        github_unavailable: "Private repository connections are not open yet.",
      };
      queueMicrotask(() =>
        setError(messages[ghError] ?? "GitHub connection failed."),
      );
      window.history.replaceState({}, "", window.location.pathname);
    }

    void fetch("/api/github/status", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("GitHub status request failed.");
        return response.json();
      })
      .then((nextStatus) => setStatus(nextStatus))
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Failed to load GitHub connection status.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

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
        <div className="flex items-center justify-between gap-4 rounded-xl border border-recent/30 bg-recent/5 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-recent" />
              <p className="text-sm font-medium text-paper">Legacy connection: {status.username}</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-light">
              Private imports are paused while Locus moves to least-privilege access. This connection is not used for analysis; disconnect it to remove the stored token.
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
            Private repository access is not available in the public beta. Locus is moving this flow to a least-privilege GitHub App before opening it.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/[0.1]"
          >
            Join the Pro waitlist
          </Link>
        </div>
      )}
    </div>
  );
}
