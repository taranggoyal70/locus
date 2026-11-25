"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Small motion pieces for the public pages. Every one follows the same rule:
 * the server renders the final state, and an element only animates if it was
 * offscreen when the page loaded and later scrolls into view. Anything already
 * on screen keeps its final state, so nothing flashes from shown to hidden, and
 * readers without JavaScript or with reduced motion get the finished page.
 */

function stillMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window);
}

/**
 * Calls `arm` at once if the element starts offscreen, then `enter` the first
 * time it scrolls into view. Both are module-level functions of the element,
 * so the effect never re-runs.
 */
export function useEnterView<T extends HTMLElement>(
  ref: RefObject<T | null>,
  arm: (element: T) => void,
  enter: (element: T) => void,
  threshold = 0.3,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || stillMotion()) return;
    const box = element.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;
    arm(element);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      enter(element);
    }, { threshold });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, arm, enter, threshold]);
}

type Line = string | { text: string; className: string };

const armRise = (element: HTMLElement) => element.classList.add("is-armed");
const enterRise = (element: HTMLElement) => element.classList.remove("is-armed");

/**
 * A heading whose words rise out of a mask, one after another. `onLoad` plays
 * on first paint with CSS alone (for the hero); otherwise it plays when the
 * heading scrolls into view.
 */
export function RiseWords({
  as = "h2",
  lines,
  className = "",
  onLoad = false,
}: {
  as?: "h1" | "h2" | "h3" | "p";
  lines: Line[];
  className?: string;
  onLoad?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEnterView(ref, onLoad ? noop : armRise, onLoad ? noop : enterRise, 0.6);

  let index = 0;
  const children = lines.map((line, lineIndex) => {
    const { text, className: lineClass } = typeof line === "string" ? { text: line, className: "" } : line;
    const words = text.split(" ");
    return (
      <span key={lineIndex} className={`block ${lineClass}`}>
        {words.map((word, wordIndex) => (
          <span key={wordIndex}>
            <span className="rise-w">
              <span style={{ "--i": index++ } as React.CSSProperties}>{word}</span>
            </span>
            {wordIndex < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    );
  });

  // The words are split into masks for the motion, so the heading also carries
  // its sentence whole: assistive tech reads it once instead of word by word.
  const label = lines.map((line) => (typeof line === "string" ? line : line.text)).join(" ");

  // Typed as h2 so one ref type fits every tag; the element is whichever `as` names.
  const Tag = as as "h2";
  return <Tag ref={ref} aria-label={label} className={`rise ${onLoad ? "rise-load" : ""} ${className}`}>{children}</Tag>;
}

function noop() {}

const GLYPHS = "./_-[]()01";

function armScramble(element: HTMLElement) {
  element.dataset.text = element.textContent ?? "";
}

function enterScramble(element: HTMLElement) {
  const text = element.dataset.text ?? element.textContent ?? "";
  const chars = Array.from(text);
  const start = performance.now();
  const duration = 650;
  const tick = (now: number) => {
    const t = (now - start) / duration;
    if (t >= 1) {
      element.textContent = text;
      return;
    }
    const settled = Math.floor(t * chars.length * 1.15);
    element.textContent = chars
      .map((char, i) => (i < settled || char === " " ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
      .join("");
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** A mono label that decodes from glyph noise, left to right, when it scrolls into view. */
export function Scramble({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEnterView(ref, armScramble, enterScramble, 0.9);
  return <span ref={ref} className={className}>{text}</span>;
}

function format(value: number, suffix: string) {
  return `${Math.round(value).toLocaleString("en-US")}${suffix}`;
}

function armCount(element: HTMLElement) {
  element.textContent = format(0, element.dataset.suffix ?? "");
}

function enterCount(element: HTMLElement) {
  const to = Number(element.dataset.to);
  const suffix = element.dataset.suffix ?? "";
  const start = performance.now();
  const duration = 1100;
  const tick = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / duration));
    element.textContent = format(to * (1 - (1 - t) ** 3), suffix);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** A number that ticks up to its printed value when it scrolls into view. */
export function CountUp({ value, suffix = "", className = "" }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEnterView(ref, armCount, enterCount, 0.8);
  return (
    <span ref={ref} className={className} data-to={value} data-suffix={suffix}>
      {format(value, suffix)}
    </span>
  );
}

/**
 * A number that rolls from the value it showed to its new one. It never plays
 * on first paint, and with reduced motion it simply changes. React owns the
 * text, so the roll starts by putting the old value back.
 */
export function RollNumber({ value, suffix = "", className = "" }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const element = ref.current;
    const from = shown.current;
    if (!element || from === value) return;
    if (stillMotion()) {
      shown.current = value;
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 700));
      shown.current = from + (value - from) * (1 - (1 - t) ** 3);
      element.textContent = format(shown.current, suffix);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    tick(start);
    return () => cancelAnimationFrame(frame);
  }, [value, suffix]);
  return <span ref={ref} className={className}>{format(value, suffix)}</span>;
}

/** Adds `is-armed` while a block that started offscreen has not been seen yet. Its CSS decides what that means. */
export function EnterOnce({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEnterView(ref, armRise, enterRise, 0.4);
  return <div ref={ref} className={className}>{children}</div>;
}
