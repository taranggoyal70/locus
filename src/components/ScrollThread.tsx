"use client";

import { useEffect, useRef } from "react";

/**
 * A hairline under the header that fills left to right as the page scrolls.
 * It follows the scroll position directly rather than animating on its own, so
 * it needs no reduced-motion variant.
 */
export function ScrollThread() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const progress = room > 0 ? Math.min(1, window.scrollY / room) : 0;
      ref.current?.style.setProperty("transform", `scaleX(${progress})`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute inset-x-0 -bottom-px h-px origin-left bg-ink"
      style={{ transform: "scaleX(0)" }}
    />
  );
}
