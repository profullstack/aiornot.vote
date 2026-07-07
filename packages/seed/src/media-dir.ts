import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Walk up to the workspace root (dir containing pnpm-workspace.yaml). */
function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * Where locally-stored media (AI images) live when object storage (R2) is not
 * configured. Override with MEDIA_STORAGE_DIR — set this to a persistent volume
 * path (e.g. /data/media) in production. Both the seed writer and the web
 * `/media` serving route resolve through here so they always agree.
 */
export function mediaStorageDir(): string {
  return process.env.MEDIA_STORAGE_DIR || resolve(workspaceRoot(), ".media");
}
