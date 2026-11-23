import { frame } from "@/components/Datasheet";
import { RiseWords } from "@/components/Reveal";

/** An ink text link: underlined in a hairline that darkens on hover. Colour is kept for file state. */
export const inkLink =
  "font-medium text-ink underline decoration-line-2 underline-offset-[5px] transition-colors duration-150 hover:decoration-ink";

/** The mono voice for labels and metadata. */
export const monoLabel = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";

/**
 * The opening of a secondary public page: a mono label, a serif title whose
 * optional second line is muted (statement, then consequence), a lead
 * paragraph, and an optional aside on the right at desktop widths.
 */
export function PageHeader({
  label,
  title,
  subtitle,
  children,
  aside,
  app = false,
}: {
  label: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Sits to the right of the title at desktop widths; the title steps down a size to make room. */
  aside?: React.ReactNode;
  /** A signed-in page: the same opening a size down, so the work starts higher. */
  app?: boolean;
}) {
  const size = app
    ? "text-[clamp(38px,4.6vw,60px)]"
    : aside
      ? "text-[clamp(40px,4.8vw,66px)]"
      : "text-[clamp(40px,6vw,80px)]";
  return (
    <header className={`${frame} grid gap-10 ${app ? "pb-10 pt-10 sm:pb-12 sm:pt-14" : "pb-12 pt-14 sm:pb-16 sm:pt-20"} lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end`}>
      <div className="min-w-0">
        <p className={monoLabel}>{label}</p>
        <RiseWords
          as="h1"
          onLoad
          lines={subtitle ? [title, { text: subtitle, className: "text-muted" }] : [title]}
          className={`${app ? "mt-4" : "mt-5"} max-w-5xl font-display ${size} font-normal leading-[0.98] tracking-[-0.02em] text-ink`}
        />
        {children ? <div className={`${app ? "mt-5" : "mt-7"} max-w-2xl text-[17px] leading-[1.65] text-ink-2`}>{children}</div> : null}
      </div>
      {aside ? <div className="min-w-0">{aside}</div> : null}
    </header>
  );
}
