import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "AIorNot.vote — can you tell what's AI?";
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
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b0b12 0%, #171726 100%)",
          color: "#e6e6ef",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 84, fontWeight: 900, letterSpacing: -2 }}>
          <span style={{ color: "#6c5ce7" }}>AI</span>
          <span style={{ color: "#8a8a9a" }}>or</span>
          <span style={{ color: "#00d1b2" }}>NOT</span>
          <span style={{ color: "#e6e6ef" }}>.vote</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 40, color: "#c7c7d1" }}>
          Can you tell what&apos;s AI?
        </div>
        <div style={{ marginTop: 16, fontSize: 24, color: "#8a8a9a" }}>
          Crowd-sourced AI-vs-real detection · play free · API · RSS
        </div>
      </div>
    ),
    { ...size },
  );
}
