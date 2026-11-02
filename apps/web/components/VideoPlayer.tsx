"use client";
import { Player } from "@profullstack/player/react";
import "@profullstack/player/player.css";

/**
 * The house player (@profullstack/player): one control bar that hides itself,
 * full screen on every device including iPhone, MP4/HLS/MPEG-TS sniffed from
 * the URL. Server components render this instead of a raw <video>.
 */
export function VideoPlayer({
  src,
  poster,
  mediaId,
  className,
  shareable = false,
}: {
  src: string;
  poster?: string | null;
  mediaId?: string;
  className?: string;
  shareable?: boolean;
}) {
  return (
    <Player
      src={src}
      poster={poster || undefined}
      mediaId={mediaId}
      className={className}
      shareable={shareable}
      useTimeParam={shareable}
    />
  );
}
