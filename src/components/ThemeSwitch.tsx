"use client";

import { useSyncExternalStore } from "react";

import {
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string; glyph: string }> = [
  { value: "system", label: "System", glyph: "◐" },
  { value: "light", label: "Light", glyph: "○" },
  { value: "dark", label: "Dark", glyph: "●" },
];

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function choose(preference: ThemePreference) {
  applyThemePreference(preference);
  listeners.forEach((listener) => listener());
}

/** A three-way System / Light / Dark switch. */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  // The server cannot know a stored preference, so it renders "system" and the
  // client corrects it after hydration without a mismatch warning.
  const current = useSyncExternalStore(subscribe, readThemePreference, () => "system" as const);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex h-8 items-center rounded-chip border border-line p-0.5 ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.label}
            onClick={() => choose(option.value)}
            className={`inline-flex h-full items-center gap-1.5 rounded-[3px] px-2 font-mono text-[11px] transition-colors duration-150 ${
              active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <span aria-hidden="true" className="text-[11px] leading-none">{option.glyph}</span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
