export function AlphaSettingsNotice() {
  return (
    <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        Controlled alpha
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-paper">
        Public-Repo access for invited design partners
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-light">
        Locus is free during the controlled alpha. Agent Runs are limited to invited
        design partners working with public repositories while the review and delivery
        boundaries are hardened.
      </p>
    </section>
  );
}
