import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Locus — the token-efficient coding agent";
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
          background: "#f1eee6",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "12px",
              background: "#2457ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 800,
              color: "#f1eee6",
            }}
          >
            L
          </div>
          <span style={{ fontSize: "28px", color: "#111d2b", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Locus
          </span>
        </div>
        <h1
          style={{
            marginTop: "32px",
            fontSize: "64px",
            fontWeight: 700,
            color: "#111d2b",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            maxWidth: "800px",
          }}
        >
          Ship the task. Not the repository.
        </h1>
        <p
          style={{
            marginTop: "24px",
            fontSize: "24px",
            color: "#48525e",
            maxWidth: "700px",
            lineHeight: 1.4,
          }}
        >
          Focus context, implement in an isolated sandbox, verify the change, and approve delivery.
        </p>
        <div
          style={{
            marginTop: "40px",
            display: "flex",
            gap: "12px",
          }}
        >
          {["Locate", "Implement", "Verify", "Approve"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "1px solid rgba(17, 29, 43, 0.2)",
                color: "#48525e",
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
