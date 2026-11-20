import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Locus · Ship the task. Not the repo.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Light tokens from globals.css. The card is always the paper theme.
const canvas = "#f3f1ea";
const ink = "#14233b";
const ink2 = "#3e4f63";
const muted = "#5c6a78";
const line2 = "rgba(20, 35, 59, 0.2)";
const included = "#087864";
const excluded = "#d6d1c5";

// The renderer reads neither WOFF2 nor variable fonts, so these are static,
// Latin-only instances of the site's own faces (see src/assets/fonts/OFL.txt).
const fontDir = join(process.cwd(), "src/assets/fonts");

// A decorative field of file marks, drawn like MiniField: a few inked files in
// a field of faint ones. It illustrates a Slice; it is not a real run.
const FIELD_COLUMNS = 12;
const FIELD_ROWS = 4;
const SLICE = new Set([3, 4, 15, 16, 17, 28, 30, 41]);

function Mark({ size: px }: { size: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill={ink} />
      <path d="M7 10.5h8.5a6 6 0 0 1 6 6v5" fill="none" stroke="#8ef0c0" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M7 21.5h8.5a6 6 0 0 0 6-6v-5" fill="none" stroke="#ffd45c" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="19" y="19" width="6" height="6" rx="2" fill="#ff896e" />
    </svg>
  );
}

export default async function OgImage() {
  const [newsreader, geist, geistMono] = await Promise.all([
    readFile(join(fontDir, "Newsreader-Display.ttf")),
    readFile(join(fontDir, "Geist-Regular.ttf")),
    readFile(join(fontDir, "GeistMono-Medium.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px 64px",
          background: canvas,
          color: ink,
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Mark size={44} />
            <span style={{ fontFamily: "Newsreader", fontSize: "38px", letterSpacing: "-0.02em" }}>Locus</span>
          </div>
          <span
            style={{
              fontFamily: "Geist Mono",
              fontSize: "15px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: muted,
            }}
          >
            Evidence-first code localization
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Newsreader",
            fontSize: "136px",
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
          }}
        >
          <span>Ship the task.</span>
          <span style={{ color: muted }}>Not the repo.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ height: "1px", background: line2 }} />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "28px" }}>
            <span style={{ maxWidth: "640px", fontSize: "26px", lineHeight: 1.4, color: ink2 }}>
              Paste a public GitHub project. Locus finds the files an AI coding tool needs and shows why.
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", width: `${FIELD_COLUMNS * 16 + (FIELD_COLUMNS - 1) * 6}px` }}>
              {Array.from({ length: FIELD_COLUMNS * FIELD_ROWS }, (_, index) => (
                <div
                  key={index}
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "3px",
                    background: SLICE.has(index) ? included : excluded,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: newsreader, weight: 400, style: "normal" },
        { name: "Geist", data: geist, weight: 400, style: "normal" },
        { name: "Geist Mono", data: geistMono, weight: 500, style: "normal" },
      ],
    },
  );
}
