import "server-only";
import { sqlClient } from "./db";

export type FollowCounts = { followers: number; following: number };

export async function followUser(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) return; // no self-follow
  await sqlClient.execute({
    sql: "INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)",
    args: [followerId, followeeId],
  });
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  await sqlClient.execute({
    sql: "DELETE FROM follows WHERE follower_id = ? AND followee_id = ?",
    args: [followerId, followeeId],
  });
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const r = await sqlClient.execute({
    sql: "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ? LIMIT 1",
    args: [followerId, followeeId],
  });
  return r.rows.length > 0;
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const r = await sqlClient.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM follows WHERE followee_id = ?) AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
    args: [userId, userId],
  });
  const row = r.rows[0];
  return { followers: Number(row?.followers ?? 0), following: Number(row?.following ?? 0) };
}

export type PublicProfile = {
  id: string;
  displayName: string;
  isMember: boolean;
  createdAt: string;
};

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const r = await sqlClient.execute({
    sql: `SELECT id, display_name, is_lifetime_member, created_at, status
          FROM users WHERE id = ? LIMIT 1`,
    args: [userId],
  });
  const row = r.rows[0];
  if (!row || row.status === "deleted" || row.status === "suspended") return null;
  return {
    id: row.id as string,
    displayName: (row.display_name as string) || "Player",
    isMember: Number(row.is_lifetime_member ?? 0) === 1,
    createdAt: row.created_at as string,
  };
}

export type FollowRankRow = { rank: number; userId: string; displayName: string; count: number };

async function followRanking(kind: "followers" | "following", limit: number): Promise<FollowRankRow[]> {
  // followers = ranked by inbound edges (followee_id); following = outbound (follower_id).
  const groupCol = kind === "followers" ? "followee_id" : "follower_id";
  const r = await sqlClient.execute({
    sql: `SELECT f.${groupCol} AS uid, COUNT(*) AS c, u.display_name AS name
          FROM follows f JOIN users u ON u.id = f.${groupCol}
          WHERE u.status = 'active'
          GROUP BY f.${groupCol}
          ORDER BY c DESC, name ASC
          LIMIT ?`,
    args: [limit],
  });
  return r.rows.map((row, i) => ({
    rank: i + 1,
    userId: row.uid as string,
    displayName: (row.name as string) || "Player",
    count: Number(row.c ?? 0),
  }));
}

export const getMostFollowed = (limit = 100) => followRanking("followers", limit);
export const getMostFollowing = (limit = 100) => followRanking("following", limit);
