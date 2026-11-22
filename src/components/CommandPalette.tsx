"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import { chooseTheme } from "@/components/ThemeSwitch";
import type { ThemePreference } from "@/lib/theme";

type Answer = { title: string; body: string; href: string; linkLabel: string };

type Action =
  | { kind: "go"; href: string }
  | { kind: "answer"; answer: Answer }
  | { kind: "theme"; value: ThemePreference };

type Command = {
  group: "Go to" | "Docs" | "Ask Locus" | "Theme";
  label: string;
  /** More words a search matches, never shown. */
  keywords?: string;
  /** The number key that opens this page anywhere on the site (NavShortcuts). */
  shortcut?: string;
  action: Action;
};

const go = (href: string): Action => ({ kind: "go", href });

/**
 * Every answer restates copy the site already publishes, so the menu can never
 * make a claim the pages do not.
 */
const COMMANDS: Command[] = [
  { group: "Go to", label: "Home", action: go("/") },
  { group: "Go to", label: "Try a task, no sign-in", keywords: "slice figure aperture localize", action: go("/#try") },
  { group: "Go to", label: "Benchmark cases", keywords: "evidence recall results held-out heldout", action: go("/#evidence") },
  { group: "Go to", label: "Demo", shortcut: "1", keywords: "migration video", action: go("/demo") },
  { group: "Go to", label: "Evidence", shortcut: "2", keywords: "release study protocol gate", action: go("/evidence/release-1") },
  { group: "Go to", label: "Docs", shortcut: "3", keywords: "api reference", action: go("/docs") },
  { group: "Go to", label: "Agent access", shortcut: "4", keywords: "agent runs request invite plans", action: go("/pricing") },
  { group: "Go to", label: "Workspace", keywords: "app localize repo", action: go("/workspace") },
  { group: "Go to", label: "Sign in", keywords: "account log in", action: go("/sign-in") },
  { group: "Docs", label: "Authentication", keywords: "api key bearer token", action: go("/docs#authentication") },
  { group: "Docs", label: "POST /api/v1/locate", keywords: "endpoint request response example curl", action: go("/docs#locate") },
  { group: "Docs", label: "Rate limits", keywords: "quota", action: go("/docs#rate-limits") },
  { group: "Docs", label: "Error codes", keywords: "status", action: go("/docs#errors") },
  { group: "Docs", label: "Public availability", keywords: "cli mcp npm package download source code github", action: go("/docs#availability") },
  {
    group: "Ask Locus",
    label: "Does Locus write to my repository?",
    keywords: "github permissions access",
    action: {
      kind: "answer",
      answer: {
        title: "No.",
        body: "Localizing a Repo needs no repository write access, and external GitHub writes stay disabled in early access.",
        href: "/privacy",
        linkLabel: "Read the privacy page",
      },
    },
  },
  {
    group: "Ask Locus",
    label: "What happens when nothing matches the task?",
    keywords: "widen fallback guess",
    action: {
      kind: "answer",
      answer: {
        title: "Locus Widens.",
        body: "It keeps the whole Repo instead of guessing a small Slice, and shows the task words it could not find so you can refine the task.",
        href: "/#try",
        linkLabel: "Try a task",
      },
    },
  },
  {
    group: "Ask Locus",
    label: "Which Repos can I localize?",
    keywords: "languages javascript typescript python free",
    action: {
      kind: "answer",
      answer: {
        title: "Public GitHub Repos.",
        body: "JavaScript, TypeScript, and Python. It is free, with no card and no repository write access.",
        href: "/workspace",
        linkLabel: "Open the workspace",
      },
    },
  },
  {
    group: "Ask Locus",
    label: "Is the task on the home page sent anywhere?",
    keywords: "privacy browser demo figure",
    action: {
      kind: "answer",
      answer: {
        title: "No.",
        body: "The home page demo runs the real localizer in your tab, on a bundled copy of shadcn-ui/taxonomy.",
        href: "/#try",
        linkLabel: "Open the demo",
      },
    },
  },
  {
    group: "Ask Locus",
    label: "How is Locus measured?",
    keywords: "benchmark evidence recall",
    action: {
      kind: "answer",
      answer: {
        title: "Against held-out fixes.",
        body: "Locus runs on each fix's parent commit in third-party Repos it was never tuned on, and the Slice has to contain the files the fix went on to change. It does not measure agent completion.",
        href: "/evidence/release-1#cases",
        linkLabel: "See every case",
      },
    },
  },
  { group: "Theme", label: "Use the system theme", keywords: "auto appearance", action: { kind: "theme", value: "system" } },
  { group: "Theme", label: "Use the light theme", keywords: "appearance day", action: { kind: "theme", value: "light" } },
  { group: "Theme", label: "Use the dark theme", keywords: "appearance night", action: { kind: "theme", value: "dark" } },
];

const GLYPH: Record<Command["group"], string> = { "Go to": "→", Docs: "§", "Ask Locus": "?", Theme: "◐" };

function matches(command: Command, terms: string[]): boolean {
  const text = `${command.group} ${command.label} ${command.keywords ?? ""}`.toLowerCase();
  return terms.every((term) => text.includes(term));
}

const noSubscription = () => () => {};
const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * The command menu: ⌘K (Ctrl+K elsewhere) or the header's Search button opens
 * it on every public page. It goes to pages and doc sections, answers the
 * common questions in place, and switches the theme. A native modal dialog, so
 * the page behind is inert, Escape closes it and focus returns to where it was.
 * Nothing in it renders until it opens.
 */
export function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const modifier = useSyncExternalStore(noSubscription, () => (isApple() ? "⌘" : "Ctrl "), () => "⌘");

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return COMMANDS.filter((command) => matches(command, terms));
  }, [query]);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  const groups = useMemo(() => {
    const grouped: Array<{ group: Command["group"]; items: Array<{ command: Command; index: number }> }> = [];
    results.forEach((command, index) => {
      const last = grouped.at(-1);
      if (last?.group === command.group) last.items.push({ command, index });
      else grouped.push({ group: command.group, items: [{ command, index }] });
    });
    return grouped;
  }, [results]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      setOpen((value) => !value);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  const close = () => dialogRef.current?.close();

  /**
   * Options that go somewhere are real links, so Next routes them exactly as a
   * pointer click would. The dialog closes first and hands focus back, so that
   * restoring focus cannot scroll the page away from the target. A section on
   * this same page is scrolled to and focused here instead.
   */
  function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
    close();
    const url = new URL(href, window.location.href);
    const target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    if (!target || url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
    event.preventDefault();
    window.history.pushState(null, "", url.hash);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  function run(command: Command) {
    const { action } = command;
    if (action.kind === "answer") setAnswer(action.answer);
    if (action.kind === "theme") {
      close();
      chooseTheme(action.value);
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      // A click, so a link option navigates the same way as when pressed.
      document.getElementById(optionId(activeIndex))?.click();
    }
  }

  function reset() {
    setOpen(false);
    setQuery("");
    setActive(0);
    setAnswer(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="hidden h-9 items-center gap-2 rounded-chip px-2.5 text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink lg:inline-flex"
      >
        Search
        <span aria-hidden="true" className="keycap">{modifier}K</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Search Locus"
        className="palette"
        onClose={reset}
        // A click on the backdrop lands on the dialog itself; the panel fills it, so clicks inside never do.
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        {open && (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-4">
              <span aria-hidden="true" className="font-mono text-[13px] text-muted">&gt;</span>
              <input
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={results.length > 0 ? optionId(activeIndex) : undefined}
                aria-label="Search pages, docs, and answers"
                placeholder="Search pages, docs, and answers"
                value={query}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                  setAnswer(null);
                }}
                onKeyDown={onInputKeyDown}
                className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted"
              />
              <span aria-hidden="true" className="keycap">esc</span>
            </div>

            <div aria-live="polite" className={answer ? "shrink-0 border-b border-line bg-canvas/40 px-4 py-4" : "shrink-0"}>
              {answer && (
                <>
                  <p className="font-display text-[22px] leading-tight tracking-[-0.01em] text-ink">{answer.title}</p>
                  <p className="mt-1.5 text-[14px] leading-6 text-ink-2">{answer.body}</p>
                  <Link
                    href={answer.href}
                    onClick={(event) => follow(event, answer.href)}
                    className="mt-2 inline-block text-[13px] font-medium text-ink underline decoration-line-2 underline-offset-[5px] transition-colors hover:decoration-ink"
                  >
                    {answer.linkLabel}
                  </Link>
                </>
              )}
            </div>

            {/* Sized by its content and shrunk to the dialog's max-height, where it scrolls. Not
                flex-1: the dialog's height is not set, and WebKit resolves a 0% basis to nothing. */}
            <div id={listId} role="listbox" aria-label="Commands" className="min-h-0 flex-auto overflow-y-auto p-1.5">
              {groups.map(({ group, items }) => (
                <div key={group} role="group" aria-label={group}>
                  <p aria-hidden="true" className="px-3 pb-1 pt-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    {group}
                  </p>
                  {items.map(({ command, index }) => {
                    const isActive = index === activeIndex;
                    const { action } = command;
                    const option = {
                      id: optionId(index),
                      role: "option",
                      "aria-selected": isActive,
                      onPointerMove: () => {
                        if (!isActive) setActive(index);
                      },
                      className: `flex h-10 cursor-pointer items-center justify-between gap-3 rounded-chip px-3 text-[15px] ${
                        isActive ? "bg-surface-2 text-ink" : "text-ink-2"
                      }`,
                    } as const;
                    const content = (
                      <>
                        <span className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="w-3 shrink-0 text-center font-mono text-[12px] text-muted">{GLYPH[command.group]}</span>
                          <span className="truncate">{command.label}</span>
                        </span>
                        {command.shortcut && <span aria-hidden="true" className="keycap">{command.shortcut}</span>}
                      </>
                    );
                    if (action.kind !== "go") {
                      return <div key={command.label} {...option} onClick={() => run(command)}>{content}</div>;
                    }
                    // Options are reached through the input (aria-activedescendant), never by Tab.
                    return (
                      <Link key={command.label} {...option} href={action.href} tabIndex={-1} onClick={(event) => follow(event, action.href)}>
                        {content}
                      </Link>
                    );
                  })}
                </div>
              ))}
              {results.length === 0 && (
                <p className="px-3 py-8 text-center text-[14px] text-muted">Nothing matches. Try &ldquo;docs&rdquo; or &ldquo;theme&rdquo;.</p>
              )}
            </div>

            <div aria-hidden="true" className="flex shrink-0 gap-4 border-t border-line px-4 py-2.5 font-mono text-[11px] text-muted">
              <span>↑↓ move</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
