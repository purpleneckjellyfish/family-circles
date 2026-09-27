"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  deletePostAction,
  hideFollowerPostAction,
  removeFollowerPostAction,
  unhidePostAction,
  updatePostAction,
} from "@/lib/actions/posts";
import { setReactionAction } from "@/lib/actions/reactions";
import { REACTION_EMOJIS } from "@/lib/reactions";
import type { ActionState } from "@/lib/actions/auth";
import type { FeedPost } from "@/lib/feed";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui-states";
import { MemoryGallery } from "@/components/memory-gallery";
import { MemoryPhoto } from "@/components/memory-photo";
import { MemoryVideo } from "@/components/memory-video";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

function formatDate(value: string | Date | null) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function occasionLabel(post: FeedPost) {
  if (post.occasion === "none") return null;
  if (post.occasionLabel) return post.occasionLabel;
  const map = {
    christmas: "Christmas",
    birthday: "Birthday",
    easter: "Easter",
    other: "Occasion",
  } as const;
  return map[post.occasion];
}

export function PostCard({
  post,
  viewerCanModerate,
  viewerCanEdit = false,
  viewerCanDelete = false,
  viewerCanReact = true,
  showFamilyLink = true,
  throwbackYearsAgo,
  index = 0,
}: {
  post: FeedPost;
  viewerCanModerate: boolean;
  viewerCanEdit?: boolean;
  viewerCanDelete?: boolean;
  viewerCanReact?: boolean;
  showFamilyLink?: boolean;
  /** When set, render as an on-this-day throwback card. */
  throwbackYearsAgo?: number;
  index?: number;
}) {
  const canModerateFollower =
    viewerCanModerate && post.authorRole === "follower";
  const [editing, setEditing] = useState(false);
  const [hideState, hideAction, hidePending] = useActionState(
    hideFollowerPostAction,
    initial,
  );
  const [unhideState, unhideAction, unhidePending] = useActionState(
    unhidePostAction,
    initial,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeFollowerPostAction,
    initial,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePostAction,
    initial,
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [reactState, reactAction, reactPending] = useActionState(
    setReactionAction,
    initial,
  );
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const whenLabel = formatDate(post.memoryDate) ?? formatDate(post.postedAt);
  const hasMedia = post.media.length > 0;
  const occasion = occasionLabel(post);
  const actionError =
    hideState.error ||
    unhideState.error ||
    removeState.error ||
    deleteState.error ||
    editError ||
    reactState.error;

  return (
    <article
      className={cn(
        "fc-photo-lift animate-fc-rise overflow-hidden rounded-xl border bg-card/60 hover:border-forest/35",
        throwbackYearsAgo != null
          ? "border-forest/30 bg-forest-soft/20"
          : "border-border/80",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className={cn("px-4 sm:px-5", hasMedia ? "pt-3" : "py-4")}>
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm text-ink-soft">
            {showFamilyLink ? (
              <Link
                href={`/families/${post.familySlug}`}
                className="hover:text-ink"
              >
                {post.familyName}
              </Link>
            ) : (
              post.familyName
            )}
            {" · "}
            {post.authorName ?? "Someone"}
            {post.authorRole === "follower" ? " · collaborator" : null}
            {whenLabel ? ` · ${whenLabel}` : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {throwbackYearsAgo != null ? (
              <span className="fc-sticker">
                On this day · {throwbackYearsAgo}{" "}
                {throwbackYearsAgo === 1 ? "year" : "years"} ago
              </span>
            ) : null}
            {occasion ? (
              <Link
                href={`/families/${post.familySlug}/browse/occasions/${post.occasion}${post.memoryDate ? `?year=${post.memoryDate.slice(0, 4)}` : ""}`}
                className="fc-sticker transition hover:bg-forest hover:text-primary-foreground"
              >
                {occasion}
              </Link>
            ) : null}
            {post.hiddenAt ? (
              <span className="text-xs tracking-wide text-ink-soft uppercase">
                Hidden
              </span>
            ) : null}
          </div>
        </header>
        {!editing && post.title ? (
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
            {post.title}
          </h2>
        ) : null}
      </div>

      {hasMedia ? (
        <div
          className={cn(
            "mt-3",
            post.media.length === 1
              ? "grid grid-cols-1"
              : post.media.length === 2
                ? "grid grid-cols-2 gap-px bg-border/60"
                : "grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-3",
          )}
        >
          {post.media.map((m, i) => {
            const cellClass =
              post.media.length === 1
                ? "min-h-[14rem] sm:min-h-[18rem]"
                : i === 0 && post.media.length > 2
                  ? "col-span-2 min-h-[12rem] sm:col-span-1 sm:min-h-[14rem]"
                  : "min-h-[10rem] sm:min-h-[12rem]";

            if (m.kind === "video") {
              return (
                <MemoryVideo
                  key={m.id}
                  src={`/api/media/${m.id}`}
                  poster={
                    m.hasLocalFile
                      ? `/api/media/${m.id}?variant=poster`
                      : undefined
                  }
                  durationMs={m.durationMs}
                  className={cellClass}
                />
              );
            }

            return (
              <MemoryPhoto
                key={m.id}
                src={`/api/media/${m.id}`}
                onOpen={() => setGalleryIndex(i)}
                className={cellClass}
                imgClassName={
                  post.media.length === 1
                    ? "max-h-[28rem]"
                    : "max-h-none h-full"
                }
              />
            );
          })}
        </div>
      ) : null}

      {galleryIndex != null ? (
        <MemoryGallery
          items={post.media.map((m) => ({
            id: m.id,
            kind: m.kind,
            src: `/api/media/${m.id}`,
            poster:
              m.kind === "video" && m.hasLocalFile
                ? `/api/media/${m.id}?variant=poster`
                : undefined,
          }))}
          index={galleryIndex}
          onIndex={setGalleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      ) : null}

      <div className={cn("px-4 sm:px-5", hasMedia ? "py-3" : "pb-4")}>
        {editing ? (
          <form
            className="mt-3 space-y-3"
            action={async (fd) => {
              setEditPending(true);
              setEditError(null);
              const result = await updatePostAction({}, fd);
              setEditPending(false);
              if (result.error) {
                setEditError(result.error);
                return;
              }
              setEditing(false);
            }}
          >
            <input type="hidden" name="postId" value={post.id} />
            <Input
              name="title"
              defaultValue={post.title ?? ""}
              placeholder="Title"
              maxLength={140}
              className="font-display text-lg"
            />
            <Textarea
              name="body"
              defaultValue={post.body ?? ""}
              rows={4}
              maxLength={8000}
            />
            <div className="flex flex-wrap gap-3">
              <Input
                name="memoryDate"
                type="date"
                defaultValue={post.memoryDate ?? ""}
                className="h-8 w-auto"
              />
              <select
                name="occasion"
                defaultValue={post.occasion}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="none">No occasion</option>
                <option value="christmas">Christmas</option>
                <option value="birthday">Birthday</option>
                <option value="easter">Easter</option>
                <option value="other">Other</option>
              </select>
              <Input
                name="occasionLabel"
                defaultValue={post.occasionLabel ?? ""}
                placeholder="Label"
                className="h-8 max-w-[10rem]"
              />
            </div>
            {post.people.map((p) => (
              <input
                key={p.id}
                type="hidden"
                name="personIds"
                value={p.id}
              />
            ))}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={editPending}>
                {editPending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : post.body ? (
          <p className="whitespace-pre-wrap text-ink leading-relaxed">
            {post.body}
          </p>
        ) : null}

        {(post.people.length > 0 || post.albums.length > 0) && !editing ? (
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-ink-soft">
            {post.people.map((p) => (
              <Link
                key={p.id}
                href={`/families/${post.familySlug}/browse/people/${p.id}`}
                className="rounded-md bg-forest-soft/60 px-2 py-0.5 text-forest transition hover:bg-forest-soft"
              >
                {p.displayName}
              </Link>
            ))}
            {post.albums.map((a) => (
              <Link
                key={a.id}
                href={`/families/${post.familySlug}/albums/${a.id}`}
                className="rounded-md border border-border px-2 py-0.5 transition hover:border-forest/40"
              >
                Album · {a.title}
              </Link>
            ))}
          </div>
        ) : null}

        {viewerCanReact ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {REACTION_EMOJIS.map((emoji) => {
              const count =
                post.reactions.find((r) => r.emoji === emoji)?.count ?? 0;
              const mine = post.viewerReaction === emoji;
              return (
                <form key={emoji} action={reactAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="emoji" value={emoji} />
                  <button
                    type="submit"
                    disabled={reactPending}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm text-ink-soft transition duration-200 hover:text-ink",
                      mine ? "fc-react-on text-forest" : "",
                    )}
                    aria-label={`React ${emoji}`}
                  >
                    <span>{emoji}</span>
                    {count > 0 ? (
                      <span className="text-xs text-ink-soft">{count}</span>
                    ) : null}
                  </button>
                </form>
              );
            })}
          </div>
        ) : post.reactions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-ink-soft">
            {post.reactions.map((r) => (
              <span key={r.emoji}>
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        ) : null}

        <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <Link
            href={`/families/${post.familySlug}/posts/${post.id}`}
            className="hover:text-ink"
          >
            {post.commentCount === 1
              ? "1 comment"
              : `${post.commentCount} comments`}
          </Link>

          {viewerCanEdit ? (
            <button
              type="button"
              className="hover:text-ink"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          ) : null}

          {viewerCanDelete ? (
            <form action={deleteAction}>
              <input type="hidden" name="postId" value={post.id} />
              <button
                type="submit"
                className="hover:text-ink"
                disabled={deletePending}
                onClick={(e) => {
                  if (!confirm("Delete this memory?")) e.preventDefault();
                }}
              >
                Delete
              </button>
            </form>
          ) : null}

          {canModerateFollower && !post.hiddenAt ? (
            <form action={hideAction}>
              <input type="hidden" name="postId" value={post.id} />
              <button type="submit" className="hover:text-ink" disabled={hidePending}>
                Hide
              </button>
            </form>
          ) : null}
          {canModerateFollower && post.hiddenAt ? (
            <form action={unhideAction}>
              <input type="hidden" name="postId" value={post.id} />
              <button
                type="submit"
                className="hover:text-ink"
                disabled={unhidePending}
              >
                Unhide
              </button>
            </form>
          ) : null}
          {canModerateFollower ? (
            <form action={removeAction}>
              <input type="hidden" name="postId" value={post.id} />
              <button
                type="submit"
                className="text-destructive hover:underline"
                disabled={removePending}
              >
                Remove
              </button>
            </form>
          ) : null}
        </footer>

        {actionError ? (
          <ErrorBanner className="mt-3">{actionError}</ErrorBanner>
        ) : null}
      </div>
    </article>
  );
}
