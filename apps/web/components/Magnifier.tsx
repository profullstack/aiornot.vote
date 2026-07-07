"use client";
import { useRef, useState, useCallback } from "react";

type Lens = { left: number; top: number; bgX: number; bgY: number; bw: number; bh: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Client-side loupe: hover (or touch-drag) an image to inspect a zoomed region
 * for AI artifacts — warped hands, garbled text, melted edges, impossible
 * reflections. Pure CSS background zoom, no dependencies.
 *
 * `fit="cover"` (for fixed-aspect boxes like cards/arena) matches the on-screen
 * crop using the image's natural size; `fit="natural"` (detail page, image shown
 * uncropped) maps 1:1.
 */
export function Magnifier({
  src,
  alt,
  zoom = 2.6,
  lensSize = 200,
  fit = "natural",
  fill = false,
  className,
}: {
  src: string;
  alt: string;
  zoom?: number;
  lensSize?: number;
  fit?: "natural" | "cover";
  fill?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nat = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [lens, setLens] = useState<Lens | null>(null);

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        setLens(null);
        return;
      }

      // Geometry of the displayed image within the box.
      let dispW = rect.width;
      let dispH = rect.height;
      let offX = 0;
      let offY = 0;
      if (fit === "cover" && nat.current.w > 0) {
        const scale = Math.max(rect.width / nat.current.w, rect.height / nat.current.h);
        dispW = nat.current.w * scale;
        dispH = nat.current.h * scale;
        offX = (rect.width - dispW) / 2;
        offY = (rect.height - dispH) / 2;
      }

      const bw = dispW * zoom;
      const bh = dispH * zoom;
      // Keep the lens fully inside the box; center the magnified content on it.
      const cx = clamp(x, lensSize / 2, rect.width - lensSize / 2);
      const cy = clamp(y, lensSize / 2, rect.height - lensSize / 2);
      // Point on the displayed image (box coord minus letterbox offset).
      const px = cx - offX;
      const py = cy - offY;
      setLens({
        left: cx - lensSize / 2,
        top: cy - lensSize / 2,
        bgX: -(px * zoom - lensSize / 2),
        bgY: -(py * zoom - lensSize / 2),
        bw,
        bh,
      });
    },
    [zoom, lensSize, fit],
  );

  return (
    <div
      ref={ref}
      className={`magnifier ${fill ? "fill" : ""} ${className ?? ""}`}
      onMouseMove={(e) => update(e.clientX, e.clientY)}
      onMouseLeave={() => setLens(null)}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) update(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) update(t.clientX, t.clientY);
      }}
      onTouchEnd={() => setLens(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          nat.current = { w: img.naturalWidth, h: img.naturalHeight };
        }}
      />
      {lens && (
        <div
          className="magnifier-lens"
          style={{
            left: lens.left,
            top: lens.top,
            width: lensSize,
            height: lensSize,
            backgroundImage: `url("${src}")`,
            backgroundSize: `${lens.bw}px ${lens.bh}px`,
            backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
          }}
        />
      )}
      <div className="magnifier-hint" aria-hidden>
        🔍 zoom for artifacts
      </div>
    </div>
  );
}
