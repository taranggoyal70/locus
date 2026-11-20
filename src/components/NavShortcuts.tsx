"use client";

import { useEffect } from "react";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * A number key opens the navigation link whose keycap prints it. The link is
 * clicked rather than routed to, so Next's client navigation, prefetching and
 * focus handling all behave exactly as for a pointer click.
 * Ignored while typing, with a modifier held, or on a key repeat.
 */
export function NavShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (!/^[1-9]$/.test(event.key) || isTyping(event.target)) return;
      const link = document.querySelector<HTMLAnchorElement>(`a[data-shortcut="${event.key}"]`);
      if (!link) return;
      event.preventDefault();
      link.click();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
