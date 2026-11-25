"use client";

import { useEffect, useRef } from "react";

/**
 * A heading you can hold a loupe to: around the pointer the type breaks into
 * file marks, and the marks right under it light like a Slice. The heading
 * itself is untouched; a canvas draws the marks and a mask opens the type
 * where they are. Nothing runs until a mouse is over it, and it is off for
 * touch and for reduced motion. Decorative.
 */
const RADIUS = 92;
const PITCH = 7;

export function TypeLens({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!box || !text || !canvas || !context) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cells: Array<{ x: number; y: number; ink: number; colour: string }> | null = null;
    let signal = "";
    let frame = 0;
    let open = 0; // 0 closed, 1 fully open
    let target = 0;
    let x = 0;
    let y = 0;
    let goalX = 0;
    let goalY = 0;

    /** Reads the type as it is laid out now into a grid of marks. */
    const sample = () => {
      const bounds = box.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      signal = getComputedStyle(canvas).getPropertyValue("--included").trim();

      const sheet = document.createElement("canvas");
      sheet.width = Math.ceil(bounds.width);
      sheet.height = Math.ceil(bounds.height);
      const ink = sheet.getContext("2d", { willReadFrequently: true });
      if (!ink) return [];
      const found: NonNullable<typeof cells> = [];
      const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const parent = node.parentElement;
        if (!parent || !node.data.trim()) continue;
        const style = getComputedStyle(parent);
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        ink.clearRect(0, 0, sheet.width, sheet.height);
        ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ink.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
        ink.textBaseline = "alphabetic";
        const metrics = ink.measureText(node.data);
        const half = (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
        ink.fillText(node.data, rect.left - bounds.left, rect.top - bounds.top + rect.height / 2 + half);
        const { data } = ink.getImageData(0, 0, sheet.width, sheet.height);
        const left = Math.max(0, Math.floor((rect.left - bounds.left) / PITCH));
        const right = Math.ceil((rect.right - bounds.left) / PITCH);
        const top = Math.max(0, Math.floor((rect.top - bounds.top) / PITCH));
        const bottom = Math.ceil((rect.bottom - bounds.top) / PITCH);
        for (let row = top; row < bottom; row += 1) {
          for (let column = left; column < right; column += 1) {
            let sum = 0;
            for (let dy = 0; dy < PITCH; dy += 2) {
              for (let dx = 0; dx < PITCH; dx += 2) {
                const px = column * PITCH + dx;
                const py = row * PITCH + dy;
                if (px < sheet.width && py < sheet.height) sum += data[(py * sheet.width + px) * 4 + 3];
              }
            }
            const coverage = sum / (255 * 16);
            if (coverage > 0.2) found.push({ x: (column + 0.5) * PITCH, y: (row + 0.5) * PITCH, ink: Math.min(1, coverage * 1.3), colour: style.color });
          }
        }
      }
      return found;
    };

    const draw = () => {
      frame = 0;
      open += (target - open) * 0.16;
      x += (goalX - x) * 0.28;
      y += (goalY - y) * 0.28;
      const settled = Math.abs(target - open) < 0.004 && Math.hypot(goalX - x, goalY - y) < 0.2;
      if (settled) open = target;
      const radius = RADIUS * open;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (open === 0) {
        text.style.maskImage = "";
        return;
      }
      text.style.maskImage = `radial-gradient(circle ${radius}px at ${x}px ${y}px, transparent 0 72%, #000 100%)`;
      for (const cell of cells ?? []) {
        const distance = Math.hypot(cell.x - x, cell.y - y);
        if (distance > radius) continue;
        const edge = Math.min(1, (radius - distance) / (radius * 0.28 + 1));
        const size = (PITCH - 1.2) * (0.5 + 0.5 * cell.ink) * (0.35 + 0.65 * edge);
        context.globalAlpha = edge;
        context.fillStyle = distance < radius * 0.36 ? signal : cell.colour;
        context.fillRect(cell.x - size / 2, cell.y - size / 2, size, size);
      }
      context.globalAlpha = 1;
      if (!settled) frame = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const place = (event: PointerEvent) => {
      const bounds = box.getBoundingClientRect();
      goalX = event.clientX - bounds.left;
      goalY = event.clientY - bounds.top;
    };
    const onEnter = (event: PointerEvent) => {
      if (text.getAnimations({ subtree: true }).some((animation) => animation.playState === "running")) return;
      place(event);
      if (open < 0.05) {
        x = goalX;
        y = goalY;
      }
      cells = sample();
      target = 1;
      wake();
    };
    const onMove = (event: PointerEvent) => {
      if (target === 0) {
        onEnter(event);
        return;
      }
      place(event);
      wake();
    };
    const onLeave = () => {
      target = 0;
      wake();
    };
    const onResize = () => {
      target = 0;
      wake();
    };

    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      text.style.maskImage = "";
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={boxRef} className="relative w-fit max-w-full">
      <div ref={textRef}>{children}</div>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
