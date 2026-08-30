export function AlphaSettingsNotice() {
  return (
    <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        Public early access
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-paper">
        Agent Runs for invited design partners
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-light">
        Repo localization is free for signed-in users during public early access. Agent Runs
        remain limited to invited design partners working with public repositories while the
        review and delivery boundaries are hardened.
      </p>
    </section>
  );
}
