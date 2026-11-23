type LedgerGroupProps = {
  label: string;
  paths: string[];
  tone: string;
};

function LedgerGroup({ label, paths, tone }: LedgerGroupProps) {
  return (
    <section className="min-w-0 border-t border-ink pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className={`font-mono text-[11px] font-medium uppercase tracking-[0.08em] ${tone}`}>
          {label}
        </h3>
        <span className="font-mono text-[11px] text-muted tabular-nums">{paths.length}</span>
      </div>
      {paths.length > 0 ? (
        <ul className="mt-2.5 max-h-40 space-y-1 overflow-auto" aria-label={`${label} files`} tabIndex={0}>
          {paths.map((path) => (
            <li key={path} className="break-all font-mono text-[12px] leading-[18px] text-ink-2">
              {path}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-[13px] text-muted">None recorded</p>
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
    <div className="grid gap-6 sm:grid-cols-3 sm:gap-5" aria-label="Run context ledger">
      <LedgerGroup label="Included" paths={included} tone="text-included-ink" />
      <LedgerGroup label="Excluded" paths={excluded} tone="text-ink-2" />
      <LedgerGroup label="Widened" paths={widened} tone="text-widened" />
    </div>
  );
}
