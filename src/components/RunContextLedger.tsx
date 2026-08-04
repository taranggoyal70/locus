type LedgerGroupProps = {
  label: string;
  paths: string[];
  tone: string;
};

function LedgerGroup({ label, paths, tone }: LedgerGroupProps) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-ink/65 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className={`font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${tone}`}>
          {label}
        </h3>
        <span className="font-mono text-[9px] text-muted">{paths.length}</span>
      </div>
      {paths.length > 0 ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-auto" aria-label={`${label} files`}>
          {paths.map((path) => (
            <li key={path} className="break-all font-mono text-[9px] leading-4 text-muted-light">
              {path}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[10px] text-muted">None recorded</p>
      )}
    </section>
  );
}

export function RunContextLedger({
  included,
  excluded,
  widened,
}: {
  included: string[];
  excluded: string[];
  widened: string[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" aria-label="Run context ledger">
      <LedgerGroup label="Included" paths={included} tone="text-accent" />
      <LedgerGroup label="Excluded" paths={excluded} tone="text-muted-light" />
      <LedgerGroup label="Widened" paths={widened} tone="text-recent" />
    </div>
  );
}
