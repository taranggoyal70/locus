"use client";

import { useSyncExternalStore } from "react";

export type ResolvedTheme = "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";

function read(): ResolvedTheme {
  const pinned = document.documentElement.dataset.theme;
  if (pinned === "light" || pinned === "dark") return pinned;
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

/**
 * The theme actually on screen: the pinned preference, else the system one.
 * For the few places that need literal colours (Clerk's widgets), since the
 * rest of the UI follows the CSS tokens on its own.
 */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, read, () => "light");
}
