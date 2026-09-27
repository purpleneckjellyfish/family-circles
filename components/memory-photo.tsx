"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/** Photo tile with soft reveal — keeps feed feeling album-first. */
export function MemoryPhoto({
  src,
  onOpen,
  className,
  imgClassName,
}: {
  src: string;
  onOpen?: () => void;
  className?: string;
  imgClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const inner = failed ? (
    <div className="flex aspect-[4/3] items-center justify-center bg-paper-deep text-sm text-ink-soft">
      Photo unavailable
    </div>
  ) : (
    <>
      <div
        className={cn(
          "absolute inset-0 bg-paper-deep transition-opacity duration-500",
          loaded ? "opacity-0" : "opacity-100",
        )}
        aria-hidden
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "h-full max-h-[28rem] w-full object-cover transition duration-700 ease-out",
          loaded ? "scale-100 opacity-100" : "scale-[1.02] opacity-0",
          "group-hover:scale-[1.02]",
          imgClassName,
        )}
      />
    </>
  );

  const shellClass = cn(
    "group relative block h-full w-full overflow-hidden border-0 bg-paper-deep p-0 text-left",
    onOpen ? "cursor-zoom-in" : "",
    className,
  );

  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} aria-label="Open photo" className={shellClass}>
        {inner}
      </button>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}
