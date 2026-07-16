"use client";

import { useCallback, useEffect, useState } from "react";

type Team = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role: string;
  created_at: string;
};

export function TeamsPanel() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTeams(data.teams);
    } catch {
      setError("Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  async function createTeam() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setNewName("");
      await loadTeams();
    } catch {
      setError("Failed to create team.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteTeam(id: string) {
    try {
      const res = await fetch(`/api/teams?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }
      setTeams((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("Failed to delete team.");
    }
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

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !creating && createTeam()}
          placeholder="Team name (e.g. Frontend squad)"
          maxLength={60}
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
        />
        <button
          onClick={createTeam}
          disabled={creating || !newName.trim()}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#b5f34a] disabled:opacity-40"
        >
          {creating ? "Creating..." : "Create team"}
        </button>
      </div>

      {teams.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No teams yet. Create one to share projects with your colleagues.
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line-strong">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-paper">{team.name}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                  <span className="capitalize">{team.role}</span>
                  <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              {team.role === "owner" && (
                <button
                  onClick={() => deleteTeam(team.id)}
                  className="ml-3 shrink-0 rounded-lg px-3 py-1.5 text-xs text-muted transition hover:bg-recent/10 hover:text-recent"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
