export function AlphaSettingsNotice() {
  return (
    <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        Public early access
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-paper">
        A real Agent Run, with an honest free limit
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-light">
        Repo localization is free for signed-in users. Locus offers one shared Agent Run per UTC
        day across the beta; you can connect your own Cloudflare account when the shared Run is
        already used. Public Repos only, with external writes still disabled.
      </p>
    </section>
  );
}
