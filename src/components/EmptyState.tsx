import { Mascot, type MascotMood } from "@/components/Mascot";

/**
 * Nothing here yet, said plainly, with the mascot and the one next step. The
 * same shape as the workspace's empty Repo panel.
 */
export function EmptyState({
  title,
  children,
  action,
  mood = "sleep",
  className = "",
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  mood?: MascotMood;
  className?: string;
}) {
  return (
    <div className={`grid place-items-center rounded-card border border-dashed border-line-2 px-6 py-12 text-center ${className}`}>
      <div className="flex max-w-sm flex-col items-center">
        <Mascot mood={mood} size={40} />
        <p className="mt-5 font-display text-[24px] font-normal leading-[1.1] tracking-[-0.012em] text-ink">{title}</p>
        {children ? <div className="mt-2 text-[14px] leading-6 text-ink-2">{children}</div> : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

/** A load or save that failed: a crimson dot and a sentence, not a filled alarm box. */
export function InlineError({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={`flex items-start gap-2.5 text-[14px] leading-6 text-failed ${className}`}>
      <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-failed" />
      <span>{children}</span>
    </p>
  );
}
