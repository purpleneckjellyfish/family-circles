"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type GalleryItem = {
  id: string;
  kind: "image" | "video";
  src: string;
  poster?: string;
};

/** Full-screen album. Arrow keys and the side buttons move through it. */
export function MemoryGallery({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: GalleryItem[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = items[index];
  const many = items.length > 1;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!many) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndex(Math.min(items.length - 1, index + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndex(Math.max(0, index - 1));
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, items.length, many, onClose, onIndex]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close gallery"
        className="absolute inset-0 bg-ink/85"
        onClick={onClose}
      />
      <button
        ref={closeRef}
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-paper/90 text-ink transition hover:bg-paper"
      >
        <X className="size-5" aria-hidden />
      </button>
      {many && index > 0 ? (
        <button
          type="button"
          aria-label="Previous"
          onClick={() => onIndex(index - 1)}
          className="absolute top-1/2 left-3 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink transition hover:bg-paper sm:left-6"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
      ) : null}
      {many && index < items.length - 1 ? (
        <button
          type="button"
          aria-label="Next"
          onClick={() => onIndex(index + 1)}
          className="absolute top-1/2 right-3 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink transition hover:bg-paper sm:right-6"
        >
          <ChevronRight className="size-6" aria-hidden />
        </button>
      ) : null}
      <div className="relative z-10 flex max-h-[88vh] max-w-[min(100%,72rem)] flex-col items-center px-14 sm:px-20">
        {item.kind === "video" ? (
          <video
            key={item.id}
            src={item.src}
            poster={item.poster}
            controls
            playsInline
            className="max-h-[80vh] max-w-full bg-ink"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.src}
            alt=""
            className="max-h-[80vh] max-w-full object-contain"
          />
        )}
        {many ? (
          <p className="mt-3 text-sm text-paper/80">
            {index + 1} of {items.length}
          </p>
        ) : null}
      </div>
    </div>
  );
}
