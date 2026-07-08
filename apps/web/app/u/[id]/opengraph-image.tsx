import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/social";
import { getUserStats } from "@/lib/queries";

export const runtime = "nodejs";
export const alt = "AIorNot.vote player stats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProfileOg({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id).catch(() => null);
  const stats = profile ? await getUserStats(profile.id).catch(() => null) : null;
  const name = profile?.displayName || "AIorNot.vote player";
  const correct = stats?.correctGuesses ?? 0;
  const acc = stats ? Math.round(stats.accuracy * 100) : 0;
  const best = stats?.bestStreak ?? 0;

  const Cell = ({ v, l, c }: { v: string | number; l: string; c: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: 88, fontWeight: 900, color: c }}>{v}</div>
      <div style={{ fontSize: 26, color: "#8a8a9a", textTransform: "uppercase", letterSpacing: 2 }}>{l}</div>
    </div>
  );

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
        <div style={{ display: "flex", fontSize: 38, fontWeight: 800 }}>
          <span style={{ color: "#6c5ce7" }}>AI</span>
          <span style={{ color: "#8a8a9a" }}>or</span>
          <span style={{ color: "#00d1b2" }}>NOT</span>
          <span style={{ color: "#e6e6ef" }}>.vote</span>
        </div>
        <div style={{ fontSize: 60, fontWeight: 900, marginTop: 18, marginBottom: 40 }}>{name}</div>
        <div style={{ display: "flex", gap: 90 }}>
          <Cell v={correct} l="Correct" c="#00d1b2" />
          <Cell v={`${acc}%`} l="Accuracy" c="#e6e6ef" />
          <Cell v={best} l="Best streak" c="#6c5ce7" />
        </div>
        <div style={{ fontSize: 28, color: "#8a8a9a", marginTop: 44 }}>Can you tell AI from real? Play free →</div>
      </div>
    ),
    { ...size },
  );
}
