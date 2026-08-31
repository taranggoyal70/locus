export function AlphaSettingsNotice({ runStartEnabled = false }: { runStartEnabled?: boolean }) {
  return (
    <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        Public early access
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-paper">
        A real Agent Run, with an honest free limit
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-light">
        {runStartEnabled
          ? "Repo localization is free for signed-in users. Your account can use one shared Agent Run per UTC day across the beta, or capacity from a connected Cloudflare account. Public Repos only, with external writes still disabled."
          : "Repo localization is free for signed-in users. Agent Runs are not enabled for this account yet; you can connect Cloudflare now and request beta access. Public Repos only, with external writes still disabled."}
      </p>
    </section>
  );
}
