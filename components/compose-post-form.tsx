"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ImagePlus,
  PartyPopper,
  Users,
  Video,
  X,
} from "lucide-react";

import { createPostAction } from "@/lib/actions/posts";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui-states";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

/** Local calendar day, so evening posts stay on today rather than UTC. */
function todayLocal() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export type ComposerCircle = {
  id: string;
  slug: string;
  name: string;
  people: Array<{ id: string; displayName: string }>;
  albums: Array<{ id: string; title: string }>;
};

const MAX_PHOTOS = 12;
const MAX_VIDEOS = 3;

type DraftMedia = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
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
  const [drafts, setDrafts] = useState<DraftMedia[]>([]);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
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

  useEffect(() => {
    return () => {
      for (const item of draftsRef.current) URL.revokeObjectURL(item.url);
    };
  }, []);

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

  const today = todayLocal();
  const customDate = memoryDate !== "" && memoryDate !== today;

  const photoCount = drafts.filter((item) => item.kind === "image").length;
  const videoCount = drafts.filter((item) => item.kind === "video").length;

  function addDrafts(list: File[], kind: DraftMedia["kind"]) {
    const cap = kind === "image" ? MAX_PHOTOS : MAX_VIDEOS;
    const have = draftsRef.current.filter((item) => item.kind === kind).length;
    const room = Math.max(0, cap - have);
    const accepted = list.slice(0, room);
    setMediaNote(
      list.length > accepted.length
        ? kind === "image"
          ? `Up to ${MAX_PHOTOS} photos in one memory.`
          : `Up to ${MAX_VIDEOS} videos in one memory.`
        : null,
    );
    if (accepted.length === 0) return;
    const next = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      kind,
    }));
    setDrafts((prev) => [...prev, ...next]);
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const hit = prev.find((item) => item.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((item) => item.id !== id);
    });
    setMediaNote(null);
  }

  function togglePerson(id: string) {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <form
      action={(formData) => {
        for (const item of draftsRef.current) {
          formData.append(
            item.kind === "image" ? "photos" : "videos",
            item.file,
          );
        }
        action(formData);
      }}
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

      <Input
        name="title"
        placeholder="Add a title"
        maxLength={140}
        className="border-0 bg-transparent px-0 font-display text-xl shadow-none focus-visible:ring-0 md:text-2xl"
      />

      {drafts.length > 0 ? (
        <div
          className={cn(
            "mt-3 overflow-hidden rounded-lg",
            drafts.length === 1
              ? "grid grid-cols-1"
              : drafts.length === 2
                ? "grid grid-cols-2 gap-1"
                : "grid grid-cols-2 gap-1 sm:grid-cols-3",
          )}
        >
          {drafts.map((item) => (
            <div
              key={item.id}
              className="relative aspect-[4/3] overflow-hidden bg-paper-deep"
            >
              {item.kind === "image" ? (
                // Local preview only — revoked when the draft is removed.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  controls
                />
              )}
              <button
                type="button"
                aria-label={
                  item.kind === "image" ? "Remove photo" : "Remove video"
                }
                onClick={() => removeDraft(item.id)}
                className="absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-full bg-ink/75 text-paper transition hover:bg-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {mediaNote ? (
        <p className="mt-2 text-xs text-ink-soft">{mediaNote}</p>
      ) : null}

      <Textarea
        name="body"
        rows={compact ? 3 : 4}
        placeholder="Add a few words"
        maxLength={8000}
        className="mt-3 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
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
          {customDate ? memoryDate : "Today"}
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
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const list = e.target.files ? Array.from(e.target.files) : [];
          if (list.length) addDrafts(list, "image");
          e.target.value = "";
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const list = e.target.files ? Array.from(e.target.files) : [];
          if (list.length) addDrafts(list, "video");
          e.target.value = "";
        }}
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

      <input
        type="hidden"
        name="memoryDate"
        value={customDate ? memoryDate : ""}
      />
      {showDate ? (
        <div className="mt-3 space-y-1 rounded-lg border border-border/60 bg-paper/40 p-3">
          <label className="text-xs text-ink-soft" htmlFor="memoryDate">
            When it happened
          </label>
          <Input
            id="memoryDate"
            type="date"
            value={memoryDate || today}
            onChange={(e) => setMemoryDate(e.target.value)}
            className="h-8 max-w-xs"
          />
          <p className="text-xs text-ink-soft">
            Today unless you choose another day.
          </p>
        </div>
      ) : null}

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
