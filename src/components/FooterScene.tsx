"use client";

import { useEffect, useRef, useState } from "react";

import { FIELD, FooterField, ORIGIN } from "@/components/FooterField";
import { Mascot, type MascotMood } from "@/components/Mascot";
import { useEnterView } from "@/components/Reveal";

/**
 * The footer's field, alive: marks near the pointer light up like a Slice and
 * fade back, a click sends a ring of signal across the Repo, and the mascot
 * walks the top edge, stopping to look when the pointer comes close. Click it
 * and it holds up its file.
 *
 * The server renders the still field (FooterField). Everything here runs only
 * while the footer is on screen in a visible tab, and not at all with reduced
 * motion, where the mascot simply stands. Decorative, so it stays out of the
 * accessibility tree and the tab order.
 */
const SPEED = 38; // CSS pixels a second
const MASCOT = 32;

const armWord = (element: HTMLElement) => element.classList.add("is-armed");
const enterWord = (element: HTMLElement) => element.classList.remove("is-armed");

type Ripple = { col: number; row: number; start: number };

export function FooterScene({ className = "" }: { className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const [mood, setMood] = useState<MascotMood>("idle");
  const [facing, setFacing] = useState<1 | -1>(1);
  // The name is set column by column the first time the footer comes into view.
  useEnterView(boxRef, armWord, enterWord, 0.35);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const walker = walkerRef.current;
    if (!box || !canvas || !walker) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const heat = new Float32Array(FIELD.columns * FIELD.rows);
    const ripples: Ripple[] = [];
    let pointer: { x: number; y: number } | null = null;
    let colour = "#ff6a3d";
    let width = 0;
    let height = 0;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let x = 0;
    let direction: 1 | -1 = 1;
    let pauseUntil = 0;
    let nextPause = performance.now() + 5000;
    let found = 0;
    let shownMood: MascotMood = "idle";
    let visible = false;
    let greeted = false;
    let frame = 0;
    let last = 0;

    const readColour = () => {
      colour = getComputedStyle(canvas).getPropertyValue("--included").trim() || colour;
    };

    const measure = () => {
      const ratio = window.devicePixelRatio || 1;
      width = box.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      // The field is drawn with preserveAspectRatio "xMidYMid slice": scaled to cover, centred.
      scale = Math.max(width / FIELD.width, height / FIELD.height);
      offsetX = (width - FIELD.width * scale) / 2;
      offsetY = (height - FIELD.height * scale) / 2;
      x = Math.min(Math.max(x, 0), Math.max(0, width - MASCOT));
    };

    const cellAt = (px: number, py: number) => ({
      col: (px - offsetX) / (FIELD.pitch * scale) - 0.35,
      row: (py - offsetY) / (FIELD.pitch * scale) - 0.35,
    });

    const say = (next: MascotMood) => {
      if (next === shownMood) return;
      shownMood = next;
      setMood(next);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(0.1, (now - (last || now)) / 1000);
      last = now;

      // The mascot: walks, pauses now and then, stops to look at a nearby pointer.
      const centre = x + MASCOT / 2;
      const near = pointer !== null && Math.abs(pointer.x - centre) < 90;
      if (now < found) say("found");
      else if (near) {
        say("look");
        const toward: 1 | -1 = pointer!.x < centre ? -1 : 1;
        if (toward !== direction) {
          direction = toward;
          setFacing(direction);
        }
      } else if (now < pauseUntil) say("idle");
      else {
        if (now > nextPause) {
          pauseUntil = now + 1800 + Math.random() * 1600;
          nextPause = pauseUntil + 4000 + Math.random() * 5000;
        }
        say("walk");
        x += direction * SPEED * dt;
        if (x <= 0 || x >= width - MASCOT) {
          x = Math.min(Math.max(x, 0), width - MASCOT);
          direction = direction === 1 ? -1 : 1;
          setFacing(direction);
        }
      }
      walker.style.transform = `translateX(${x}px)`;

      // The field: heat fades; the pointer and any ripple add to it.
      const decay = Math.exp(-dt / 0.45);
      for (let i = 0; i < heat.length; i += 1) heat[i] *= decay;
      if (pointer) {
        const { col, row } = cellAt(pointer.x, pointer.y);
        for (let r = Math.floor(row - 3); r <= row + 3; r += 1) {
          for (let c = Math.floor(col - 3); c <= col + 3; c += 1) {
            if (r < 0 || r >= FIELD.rows || c < 0 || c >= FIELD.columns) continue;
            const d = Math.hypot(c - col, (r - row) * 1.2);
            const value = 1 - d / 2.8;
            const i = r * FIELD.columns + c;
            if (value > heat[i]) heat[i] = value;
          }
        }
      }
      for (let k = ripples.length - 1; k >= 0; k -= 1) {
        const ripple = ripples[k];
        const radius = ((now - ripple.start) / 1000) * 34;
        if (radius < 0) continue;
        if (radius > FIELD.columns + 10) {
          ripples.splice(k, 1);
          continue;
        }
        const strength = Math.max(0, 1 - radius / (FIELD.columns + 10));
        for (let r = 0; r < FIELD.rows; r += 1) {
          for (let c = Math.floor(ripple.col - radius - 2); c <= ripple.col + radius + 2; c += 1) {
            if (c < 0 || c >= FIELD.columns) continue;
            const d = Math.hypot(c - ripple.col, r - ripple.row);
            const i = r * FIELD.columns + c;
            // Uneven, like ink: the wave is printed on the field, not poured over it.
            const grain = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
            const ring = (1 - Math.abs(d - radius) / 1.6) * (0.12 + 0.88 * grain * grain);
            if (ring > 0 && ring * strength > heat[i]) heat[i] = ring * strength;
          }
        }
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = colour;
      const size = FIELD.cell * scale;
      let lit = false;
      for (let r = 0; r < FIELD.rows; r += 1) {
        for (let c = 0; c < FIELD.columns; c += 1) {
          const value = heat[r * FIELD.columns + c];
          if (value < 0.02) continue;
          lit = true;
          context.globalAlpha = Math.min(1, value);
          context.fillRect(offsetX + c * FIELD.pitch * scale, offsetY + r * FIELD.pitch * scale, size, size);
        }
      }
      context.globalAlpha = 1;
      canvas.dataset.lit = String(lit);

      if (visible) frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame && visible) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    const onMove = (event: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top - (rect.height - height) };
    };
    const onLeave = () => {
      pointer = null;
    };
    const onDown = (event: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top - (rect.height - height);
      const onMascot = px >= x - 6 && px <= x + MASCOT + 6 && py < 0;
      const origin = onMascot ? cellAt(x + MASCOT / 2, 0) : cellAt(px, py);
      ripples.push({ col: origin.col, row: Math.max(0, Math.min(FIELD.rows - 1, origin.row)), start: performance.now() });
      if (onMascot) found = performance.now() + 1600;
    };

    readColour();
    measure();
    x = width * 0.62;
    walker.style.left = "0px";
    walker.style.transform = `translateX(${x}px)`;

    const sizeObserver = new ResizeObserver(measure);
    sizeObserver.observe(box);
    const viewObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting) && document.visibilityState === "visible";
      if (!visible) return;
      if (!greeted) {
        greeted = true;
        ripples.push({ ...ORIGIN, start: performance.now() + 700 });
      }
      start();
    }, { threshold: 0.35 });
    viewObserver.observe(box);
    const onVisibility = () => {
      visible = document.visibilityState === "visible" && box.getBoundingClientRect().top < window.innerHeight;
      if (visible) start();
    };
    const themeObserver = new MutationObserver(readColour);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", readColour);
    document.addEventListener("visibilitychange", onVisibility);
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerleave", onLeave);
    box.addEventListener("pointerdown", onDown);

    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      viewObserver.disconnect();
      themeObserver.disconnect();
      scheme.removeEventListener("change", readColour);
      document.removeEventListener("visibilitychange", onVisibility);
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerleave", onLeave);
      box.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <div ref={boxRef} aria-hidden="true" className={`footer-scene relative select-none ${className}`}>
      <div className="relative h-[38px]">
        <div ref={walkerRef} className="absolute bottom-0" style={{ left: "62%" }}>
          <div style={{ transform: facing === -1 ? "scaleX(-1)" : undefined }}>
            <Mascot mood={mood} size={MASCOT} />
          </div>
        </div>
      </div>
      <div className="relative">
        <FooterField />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
