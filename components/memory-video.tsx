"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/** Inline HTML5 video player with poster and soft reveal. */
export function MemoryVideo({
  src,
  poster,
  className,
  durationMs,
}: {
  src: string;
  poster?: string;
  className?: string;
  durationMs?: number | null;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center bg-paper-deep text-sm text-ink-soft",
          className,
        )}
      >
        Video unavailable
      </div>
    );
  }

  const seconds =
    durationMs && durationMs > 0 ? Math.round(durationMs / 1000) : null;

  return (
    <div className={cn("group relative bg-ink", className)}>
      <video
        controls
        playsInline
        preload="metadata"
        poster={poster}
        src={src}
        onLoadedData={() => setReady(true)}
        onError={() => setFailed(true)}
        className={cn(
          "max-h-[28rem] w-full bg-ink object-contain transition duration-500",
          ready ? "opacity-100" : "opacity-70",
        )}
      />
      {seconds != null && !ready ? (
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-ink/70 px-2 py-0.5 text-xs text-paper">
          {seconds >= 60
            ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
            : `0:${String(seconds).padStart(2, "0")}`}
        </span>
      ) : null}
    </div>
  );
}
