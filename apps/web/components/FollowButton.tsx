"use client";
import { useState } from "react";
import Link from "next/link";

export function FollowButton({
  targetId,
  initialFollowing,
  initialFollowers,
  canFollow,
}: {
  targetId: string;
  initialFollowing: boolean;
  initialFollowers: number;
  canFollow: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState(false);

  if (!canFollow) {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="lb-correct" style={{ fontSize: 18 }}>{followers}</span>
        <span className="muted-sm">followers · <Link href="/login">sign in to follow</Link></span>
      </div>
    );
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const action = following ? "unfollow" : "follow";
    // optimistic
    setFollowing(!following);
    setFollowers((n) => n + (following ? -1 : 1));
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetId, action }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFollowing(data.following);
        setFollowers(data.followers);
      } else {
        // revert
        setFollowing(following);
        setFollowers((n) => n + (following ? 1 : -1));
      }
    } catch {
      setFollowing(following);
      setFollowers((n) => n + (following ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <button className={`btn ${following ? "" : "btn-primary"}`} onClick={toggle} disabled={busy}>
        {following ? "Following ✓" : "+ Follow"}
      </button>
      <span className="muted-sm"><b className="lb-correct">{followers}</b> followers</span>
    </div>
  );
}
