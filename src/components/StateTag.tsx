export type StateTone = "passed" | "failed" | "widened" | "active" | "neutral";

const DOT: Record<StateTone, string> = {
  passed: "bg-passed",
  failed: "bg-failed",
  widened: "bg-widened",
  active: "bg-ink",
  neutral: "bg-excluded",
};

const TEXT: Record<StateTone, string> = {
  passed: "text-passed",
  failed: "text-failed",
  widened: "text-widened",
  active: "text-ink",
  neutral: "text-muted",
};

/**
 * A state, printed like the public site's tags: an outlined mono label with a
 * status dot. Colour names the state (passed, failed, Widened or attention);
 * the words carry it too, so it never depends on colour alone.
 */
export function StateTag({ tone, children, pulse = false }: { tone: StateTone; children: React.ReactNode; pulse?: boolean }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border border-line-2 px-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] ${TEXT[tone]}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[tone]} ${pulse ? "motion-safe:animate-pulse" : ""}`} />
      {children}
    </span>
  );
}
