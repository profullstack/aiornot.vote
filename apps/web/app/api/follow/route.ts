import { NextResponse } from "next/server";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { followUser, unfollowUser, getFollowCounts, getPublicProfile, isFollowing } from "@/lib/social";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to follow." }, { status: 401 });
  if (!canParticipate(user)) {
    return NextResponse.json({ ok: false, error: "Verify your email first." }, { status: 403 });
  }
  if (!rateLimit(`follow:${user.id}`, 60, 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Slow down a moment." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const targetId = String(body.userId || "");
  const action = String(body.action || "");
  if (!targetId || targetId === user.id) {
    return NextResponse.json({ ok: false, error: "Invalid target." }, { status: 400 });
  }
  if (action !== "follow" && action !== "unfollow") {
    return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
  }

  const target = await getPublicProfile(targetId);
  if (!target) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
  }

  if (action === "follow") await followUser(user.id, targetId);
  else await unfollowUser(user.id, targetId);

  const [counts, following] = await Promise.all([getFollowCounts(targetId), isFollowing(user.id, targetId)]);
  return NextResponse.json({ ok: true, following, followers: counts.followers });
}
