"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ImagePlus,
  PartyPopper,
  Users,
  Video,
} from "lucide-react";

import { createPostAction } from "@/lib/actions/posts";
import type { ActionState } from "@/lib/actions/auth";
import { earliestExifDateFromFiles } from "@/lib/exif";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui-states";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

export type ComposerCircle = {
  id: string;
  slug: string;
  name: string;
  people: Array<{ id: string; displayName: string }>;
  albums: Array<{ id: string; title: string }>;
};

const OCCASIONS = [
  { value: "none", label: "No occasion" },
  { value: "christmas", label: "Christmas" },
  { value: "birthday", label: "Birthday" },
  { value: "easter", label: "Easter" },
  { value: "other", label: "Other" },
] as const;

export function ComposePostForm({
  circles,
  defaultFamilyId,
  compact = false,
}: {
  circles: ComposerCircle[];
  defaultFamilyId?: string;
  /** Home-feed composer styling (toolbar-first). */
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(createPostAction, initial);
  const [familyId, setFamilyId] = useState(
    defaultFamilyId ?? circles[0]?.id ?? "",
  );
  const [memoryDate, setMemoryDate] = useState("");
  const [exifHint, setExifHint] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [personQuery, setPersonQuery] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [occasion, setOccasion] = useState<string>("none");
  const [showDate, setShowDate] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showOccasion, setShowOccasion] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const active = useMemo(
    () => circles.find((c) => c.id === familyId) ?? circles[0],
    [circles, familyId],
  );

  const filteredPeople = useMemo(() => {
    if (!active) return [];
    const q = personQuery.trim().toLowerCase();
    if (!q) return active.people;
    return active.people.filter((p) =>
      p.displayName.toLowerCase().includes(q),
    );
  }, [active, personQuery]);

  if (circles.length === 0 || !active) {
    return null;
  }

  function togglePerson(id: string) {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <form
      action={action}
      className={cn(
        "animate-fc-rise overflow-hidden rounded-xl border border-border/80 bg-card/70 shadow-[0_18px_40px_-32px_rgba(31,26,20,0.4)]",
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6",
      )}
    >
      <input type="hidden" name="familyId" value={active.id} />
      <input type="hidden" name="familySlug" value={active.slug} />
      {selectedPeople.map((id) => (
        <input key={id} type="hidden" name="personIds" value={id} />
      ))}

      {circles.length > 1 ? (
        <div className="mb-3">
          <select
            aria-label="Circle"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-ink"
            value={active.id}
            onChange={(e) => {
              setFamilyId(e.target.value);
              setSelectedPeople([]);
              setPersonQuery("");
            }}
          >
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mb-2 text-sm text-ink-soft">Posting to {active.name}</p>
      )}

      <Textarea
        name="body"
        rows={compact ? 3 : 4}
        placeholder="What's happening with the family?"
        maxLength={8000}
        className="border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
      />

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border/60 pt-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink-soft transition hover:bg-forest-soft/50 hover:text-forest"
          onClick={() => photoRef.current?.click()}
        >
          <ImagePlus className="size-4" aria-hidden />
          Photo
          {photoCount > 0 ? (
            <span className="text-xs text-forest">· {photoCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink-soft transition hover:bg-forest-soft/50 hover:text-forest"
          onClick={() => videoRef.current?.click()}
        >
          <Video className="size-4" aria-hidden />
          Video
          {videoCount > 0 ? (
            <span className="text-xs text-forest">· {videoCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition",
            showPeople
              ? "bg-forest-soft/60 text-forest"
              : "text-ink-soft hover:bg-forest-soft/50 hover:text-forest",
          )}
          onClick={() => setShowPeople((v) => !v)}
        >
          <Users className="size-4" aria-hidden />
          People
          {selectedPeople.length > 0 ? (
            <span className="text-xs">· {selectedPeople.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition",
            showOccasion
              ? "bg-forest-soft/60 text-forest"
              : "text-ink-soft hover:bg-forest-soft/50 hover:text-forest",
          )}
          onClick={() => setShowOccasion((v) => !v)}
        >
          <PartyPopper className="size-4" aria-hidden />
          Occasion
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition",
            showDate
              ? "bg-forest-soft/60 text-forest"
              : "text-ink-soft hover:bg-forest-soft/50 hover:text-forest",
          )}
          onClick={() => setShowDate((v) => !v)}
        >
          <CalendarDays className="size-4" aria-hidden />
          Date
        </button>
        {active.albums.length > 0 ? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition",
              showAlbum
                ? "bg-forest-soft/60 text-forest"
                : "text-ink-soft hover:bg-forest-soft/50 hover:text-forest",
            )}
            onClick={() => setShowAlbum((v) => !v)}
          >
            Album
          </button>
        ) : null}
        <div className="ml-auto">
          <Button type="submit" size="sm" disabled={pending}>
            {pending
              ? videoCount > 0
                ? "Saving…"
                : "Posting…"
              : "Share"}
          </Button>
        </div>
      </div>

      <input
        ref={photoRef}
        name="photos"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={async (e) => {
          const list = e.target.files ? Array.from(e.target.files) : [];
          setPhotoCount(list.length);
          const earliest = await earliestExifDateFromFiles(list);
          if (earliest) {
            setMemoryDate(earliest);
            setShowDate(true);
            setExifHint(`From photo EXIF: ${earliest}`);
          } else if (list.length) {
            setExifHint("No EXIF date — set one if you know it.");
            setShowDate(true);
          }
        }}
      />
      <input
        ref={videoRef}
        name="videos"
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        multiple
        className="sr-only"
        onChange={(e) => setVideoCount(e.target.files?.length ?? 0)}
      />

      {showPeople ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-paper/40 p-3">
          {active.people.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No people tags yet — add kids and relatives under People.
            </p>
          ) : (
            <>
              <Input
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Search people…"
                className="h-8"
              />
              <div className="flex flex-wrap gap-2">
                {filteredPeople.map((p) => {
                  const on = selectedPeople.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePerson(p.id)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-sm transition",
                        on
                          ? "bg-forest text-primary-foreground"
                          : "bg-muted text-ink hover:bg-forest-soft/70",
                      )}
                    >
                      {p.displayName}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}

      {showOccasion ? (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-paper/40 p-3">
          <div className="space-y-1">
            <label className="text-xs text-ink-soft" htmlFor="occasion">
              Occasion
            </label>
            <select
              id="occasion"
              name="occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {OCCASIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {occasion === "other" || occasion === "birthday" ? (
            <div className="min-w-[10rem] flex-1 space-y-1">
              <label className="text-xs text-ink-soft" htmlFor="occasionLabel">
                Label
              </label>
              <Input
                id="occasionLabel"
                name="occasionLabel"
                placeholder={
                  occasion === "birthday" ? "Whose birthday?" : "e.g. Graduation"
                }
                maxLength={80}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="occasion" value={occasion} />
      )}

      {showDate ? (
        <div className="mt-3 space-y-1 rounded-lg border border-border/60 bg-paper/40 p-3">
          <label className="text-xs text-ink-soft" htmlFor="memoryDate">
            Memory date
          </label>
          <Input
            id="memoryDate"
            name="memoryDate"
            type="date"
            value={memoryDate}
            onChange={(e) => setMemoryDate(e.target.value)}
            className="h-8 max-w-xs"
          />
          {exifHint ? (
            <p className="text-xs text-ink-soft">{exifHint}</p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="memoryDate" value={memoryDate} />
      )}

      {showAlbum && active.albums.length > 0 ? (
        <div className="mt-3 space-y-1 rounded-lg border border-border/60 bg-paper/40 p-3">
          <label className="text-xs text-ink-soft" htmlFor="albumId">
            Album
          </label>
          <select
            id="albumId"
            name="albumId"
            className="h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm"
            defaultValue=""
          >
            <option value="">No album</option>
            {active.albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {state.error ? (
        <ErrorBanner className="mt-3">{state.error}</ErrorBanner>
      ) : null}
    </form>
  );
}

/** Thin wrapper for single-circle deep links. */
export function ComposePostFormSingle({
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
  return (
    <ComposePostForm
      defaultFamilyId={familyId}
      circles={[
        {
          id: familyId,
          slug: familySlug,
          name: "This circle",
          people,
          albums,
        },
      ]}
    />
  );
}
