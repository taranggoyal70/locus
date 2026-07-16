import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Locus — task-sized context for coding agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "12px",
              background: "#a3e635",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 800,
              color: "#0a0a0a",
            }}
          >
            L
          </div>
          <span style={{ fontSize: "28px", color: "#a3e635", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Locus
          </span>
        </div>
        <h1
          style={{
            marginTop: "32px",
            fontSize: "64px",
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            maxWidth: "800px",
          }}
        >
          Task-sized context for coding agents.
        </h1>
        <p
          style={{
            marginTop: "24px",
            fontSize: "24px",
            color: "#a1a1aa",
            maxWidth: "700px",
            lineHeight: 1.4,
          }}
        >
          Map any task to the focused set of files your AI agent needs. Deterministic. No LLM in the loop.
        </p>
        <div
          style={{
            marginTop: "40px",
            display: "flex",
            gap: "12px",
          }}
        >
          {["Browser", "CLI", "MCP", "API"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "1px solid #333",
                color: "#a1a1aa",
                fontSize: "14px",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
