"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

/** The header's navigation on narrow screens: a button and a small sheet. */
export function MobileMenu({ items }: { items: ReadonlyArray<{ href: string; label: string; shortcut: string }> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
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
      if (event.key !== "Escape") return;
      // Hand focus back to the button, or it would fall to the page as the sheet hides.
      if (root.current?.contains(document.activeElement)) button.current?.focus();
      setOpen(false);
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
        ref={button}
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
        {items.map((item) => {
          // The current page reads as it does in the desktop header: its keycap is filled with ink.
          const active = pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className="flex h-10 items-center justify-between rounded-chip px-3 text-[15px] text-ink transition-colors hover:bg-surface-2"
            >
              {item.label}
              <span aria-hidden="true" className={`keycap ${active ? "border-ink bg-ink text-canvas" : ""}`}>
                {item.shortcut}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
