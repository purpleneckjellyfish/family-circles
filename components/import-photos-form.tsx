"use client";

import { useActionState, useState } from "react";

import { importPhotosAction } from "@/lib/actions/import-photos";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui-states";

const initial: ActionState = {};

/** Separate from the composer: older photos keep the day they were taken. */
export function ImportPhotosForm({
  circles,
}: {
  circles: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(importPhotosAction, initial);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  if (circles.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Bring in older photos
      </button>
      {open ? (
        <form action={action} className="mt-3 space-y-3">
          <p className="text-sm text-ink-soft">
            Choose a handful of pictures. Each one keeps the day it was taken,
            and photos from the same day stay together.
          </p>
          {circles.length > 1 ? (
            <select
              name="familyId"
              aria-label="Circle"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-ink"
              defaultValue={circles[0]?.id}
            >
              {circles.map((circle) => (
                <option key={circle.id} value={circle.id}>
                  {circle.name}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="familyId" value={circles[0]?.id} />
          )}
          <input
            type="file"
            name="photos"
            accept="image/*"
            multiple
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-ink"
            onChange={(event) => setCount(event.target.files?.length ?? 0)}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending || count === 0}>
              {pending ? "Bringing in…" : "Add to the timeline"}
            </Button>
            {count > 0 ? (
              <span className="text-sm text-ink-soft">
                {count} {count === 1 ? "photo" : "photos"}
              </span>
            ) : null}
          </div>
          {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
          {state.success ? (
            <p className="text-sm text-forest">{state.success}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
