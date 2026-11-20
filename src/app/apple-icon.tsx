import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: the mark from icon.svg, full bleed, since iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#14233b" }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <path d="M7 10.5h8.5a6 6 0 0 1 6 6v5" fill="none" stroke="#8ef0c0" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M7 21.5h8.5a6 6 0 0 0 6-6v-5" fill="none" stroke="#ffd45c" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="19" y="19" width="6" height="6" rx="2" fill="#ff896e" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
