"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

/** Inline video with muted autoplay when in view; tap to unmute. */
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [inView, setInView] = useState(false);
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.55 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduceMotion) return;
    if (inView) {
      el.muted = muted;
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [inView, muted, reduceMotion]);

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
        ref={videoRef}
        controls={reduceMotion || !muted}
        playsInline
        loop={!reduceMotion}
        muted={muted}
        preload="metadata"
        poster={poster}
        src={src}
        onLoadedData={() => setReady(true)}
        onError={() => setFailed(true)}
        onClick={() => {
          if (reduceMotion) return;
          setMuted((m) => {
            const next = !m;
            if (videoRef.current) {
              videoRef.current.muted = next;
              if (!next) void videoRef.current.play().catch(() => undefined);
            }
            return next;
          });
        }}
        className={cn(
          "max-h-[28rem] w-full cursor-pointer bg-ink object-contain transition duration-500",
          ready ? "opacity-100" : "opacity-70",
        )}
      />
      {!reduceMotion && muted && ready ? (
        <button
          type="button"
          className="absolute bottom-3 left-3 rounded-md bg-ink/70 px-2 py-1 text-xs text-paper opacity-0 transition group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setMuted(false);
            if (videoRef.current) {
              videoRef.current.muted = false;
              void videoRef.current.play().catch(() => undefined);
            }
          }}
        >
          Tap for sound
        </button>
      ) : null}
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
