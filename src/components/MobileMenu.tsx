"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

/** The header's navigation on narrow screens: a button and a small sheet. */
export function MobileMenu({ items }: { items: ReadonlyArray<{ href: string; label: string; shortcut: string }> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close after navigating. Comparing during render avoids an effect cascade.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative lg:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="ml-1 grid h-9 w-9 place-items-center rounded-chip border border-line-2 text-ink transition-colors duration-150 hover:border-ink"
      >
        <span aria-hidden="true" className="flex w-3.5 flex-col gap-[3px]">
          <span className={`h-px bg-current transition-transform duration-200 ${open ? "translate-y-1 rotate-45" : ""}`} />
          <span className={`h-px bg-current transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
          <span className={`h-px bg-current transition-transform duration-200 ${open ? "-translate-y-1 -rotate-45" : ""}`} />
        </span>
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="menu-pop absolute right-0 top-11 w-60 rounded-card border border-line-2 bg-surface p-1.5 shadow-panel"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className="flex h-10 items-center justify-between rounded-chip px-3 text-[15px] text-ink transition-colors hover:bg-surface-2"
          >
            {item.label}
            <span aria-hidden="true" className="keycap">{item.shortcut}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
