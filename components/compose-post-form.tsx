"use client";

import { useActionState, useState } from "react";

import { createPostAction } from "@/lib/actions/posts";
import type { ActionState } from "@/lib/actions/auth";
import { earliestExifDateFromFiles } from "@/lib/exif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionState = {};

export function ComposePostForm({
  familyId,
  familySlug,
  people,
  albums,
}: {
  familyId: string;
  familySlug: string;
  people: Array<{ id: string; displayName: string }>;
  albums: Array<{ id: string; title: string }>;
}) {
  const [state, action, pending] = useActionState(createPostAction, initial);
  const [memoryDate, setMemoryDate] = useState("");
  const [exifHint, setExifHint] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);

  return (
    <form action={action} className="flex w-full max-w-xl flex-col gap-4">
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="familySlug" value={familySlug} />

      <div className="space-y-2">
        <Label htmlFor="body">Caption</Label>
        <Textarea
          id="body"
          name="body"
          rows={4}
          placeholder="What happened? A few words are enough."
          maxLength={8000}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="photos">Photos</Label>
        <Input
          id="photos"
          name="photos"
          type="file"
          accept="image/*"
          multiple
          onChange={async (e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            setPreviewCount(list.length);
            const earliest = await earliestExifDateFromFiles(list);
            if (earliest) {
              setMemoryDate(earliest);
              setExifHint(`Prefill from photo EXIF: ${earliest} (you can edit).`);
            } else {
              setExifHint(
                list.length
                  ? "No EXIF dates found — set the memory date yourself if you know it."
                  : null,
              );
            }
          }}
        />
        {previewCount > 0 ? (
          <p className="text-sm text-ink-soft">{previewCount} photo(s) selected</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="memoryDate">Memory date</Label>
        <Input
          id="memoryDate"
          name="memoryDate"
          type="date"
          value={memoryDate}
          onChange={(e) => setMemoryDate(e.target.value)}
        />
        <p className="text-sm text-ink-soft">
          When the memory happened (separate from when you post).{" "}
          {exifHint ?? "EXIF dates from photos prefill this field when available."}
        </p>
      </div>

      {people.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Tag people</legend>
          <div className="flex flex-wrap gap-3">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="personIds" value={p.id} className="size-4" />
                {p.displayName}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm text-ink-soft">
          No people tags yet. Owners/adults can add kids and relatives under People.
        </p>
      )}

      {albums.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="albumId">Album (optional)</Label>
          <select
            id="albumId"
            name="albumId"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            defaultValue=""
          >
            <option value="">No album</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Share memory"}
      </Button>
    </form>
  );
}
