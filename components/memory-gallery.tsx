"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type GalleryItem = {
  id: string;
  kind: "image" | "video";
  src: string;
  poster?: string;
};

/** Full-screen album, portaled so the feed card cannot clip or trap it. */
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
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const indexRef = useRef(index);
  const onIndexRef = useRef(onIndex);
  const onCloseRef = useRef(onClose);
  const wheelLock = useRef(0);
  indexRef.current = index;
  onIndexRef.current = onIndex;
  onCloseRef.current = onClose;

  const item = items[index];
  const many = items.length > 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    closeRef.current?.focus();
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      window.scrollTo(0, scrollY);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    function step(direction: 1 | -1) {
      if (items.length < 2) return;
      const next = indexRef.current + direction;
      if (next < 0 || next >= items.length) return;
      onIndexRef.current(next);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    }

    function onWheel(event: WheelEvent) {
      if (items.length < 2) return;
      const stage = document.getElementById("memory-gallery-stage");
      if (stage && stage.scrollHeight > stage.clientHeight + 8) {
        const atTop = stage.scrollTop <= 0;
        const atBottom =
          stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 8;
        if ((event.deltaY < 0 && !atTop) || (event.deltaY > 0 && !atBottom)) {
          return;
        }
      }
      if (Math.abs(event.deltaY) < 24 && Math.abs(event.deltaX) < 24) return;
      const now = Date.now();
      if (now - wheelLock.current < 420) {
        event.preventDefault();
        return;
      }
      wheelLock.current = now;
      event.preventDefault();
      const forward = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX > 0
        : event.deltaY > 0;
      step(forward ? 1 : -1);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [items.length, mounted]);

  if (!mounted || !item) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      className="fixed inset-0 z-50"
    >
      <button
        type="button"
        aria-label="Close gallery"
        className="absolute inset-0 bg-ink/85"
        onClick={onClose}
      />
      <div
        id="memory-gallery-stage"
        className="pointer-events-none absolute inset-0 z-10 overflow-y-auto overscroll-contain"
      >
        <div className="flex min-h-full items-center justify-center px-16 py-16 sm:px-24">
          {item.kind === "video" ? (
            <video
              key={item.id}
              src={item.src}
              poster={item.poster}
              controls
              playsInline
              className="pointer-events-auto max-h-[85vh] max-w-full bg-ink"
            />
          ) : (
            <button
              type="button"
              aria-label={index < items.length - 1 ? "Next photo" : "Photo"}
              onClick={() => {
                if (index < items.length - 1) onIndex(index + 1);
              }}
              className="pointer-events-auto border-0 bg-transparent p-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={item.id}
                src={item.src}
                alt=""
                className="max-h-[85vh] max-w-full object-contain"
              />
            </button>
          )}
        </div>
      </div>
      <button
        ref={closeRef}
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 inline-flex size-10 items-center justify-center rounded-full bg-paper/95 text-ink shadow-sm transition hover:bg-paper"
      >
        <X className="size-5" aria-hidden />
      </button>
      {many && index > 0 ? (
        <button
          type="button"
          aria-label="Previous"
          onClick={() => onIndex(index - 1)}
          className="absolute top-1/2 left-3 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/95 text-ink shadow-sm transition hover:bg-paper sm:left-6"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </button>
      ) : null}
      {many && index < items.length - 1 ? (
        <button
          type="button"
          aria-label="Next"
          onClick={() => onIndex(index + 1)}
          className="absolute top-1/2 right-3 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/95 text-ink shadow-sm transition hover:bg-paper sm:right-6"
        >
          <ChevronRight className="size-6" aria-hidden />
        </button>
      ) : null}
      {many ? (
        <p className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 text-sm text-paper/85">
          {index + 1} of {items.length}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
