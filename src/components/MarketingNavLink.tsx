"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A header link with its keycap. The current page's key is filled with ink:
 * the orange signal is kept for file state, so it never marks navigation.
 */
export function MarketingNavLink({
  href,
  shortcut,
  children,
  className = "px-2.5",
  keycapClassName = "",
}: {
  href: string;
  shortcut: string;
  children: React.ReactNode;
  /** Horizontal padding and size overrides, for a header short of room. */
  className?: string;
  keycapClassName?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);

  return (
    <Link
      href={href}
      data-shortcut={shortcut}
      aria-current={active ? "page" : undefined}
      className={`group inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-chip text-[14px] transition-colors duration-150 ${className} ${
        active ? "text-ink" : "text-ink-2 hover:text-ink"
      }`}
    >
      <span
        aria-hidden="true"
        className={`keycap transition-colors duration-150 ${keycapClassName} ${
          active ? "border-ink bg-ink text-canvas" : "group-hover:border-ink group-hover:text-ink"
        }`}
      >
        {shortcut}
      </span>
      {children}
    </Link>
  );
}
