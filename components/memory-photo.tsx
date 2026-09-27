"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/** Photo tile with soft reveal — keeps feed feeling album-first. */
export function MemoryPhoto({
  src,
  href,
  className,
  imgClassName,
}: {
  src: string;
  href?: string;
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
    "group relative block overflow-hidden bg-paper-deep",
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={shellClass}
      >
        {inner}
      </a>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}
