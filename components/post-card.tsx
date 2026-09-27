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
  return d.toLocaleDateString(undefined, {
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

  const memoryLabel = formatDate(post.memoryDate);
  const postedLabel = formatDate(post.postedAt);
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
      {hasMedia ? (
        <div
          className={
            post.media.length === 1
              ? "grid grid-cols-1"
              : post.media.length === 2
                ? "grid grid-cols-2 gap-px bg-border/60"
                : "grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-3"
          }
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
                href={`/api/media/${m.id}`}
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

      <div className="p-4 sm:p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            {showFamilyLink ? (
              <Link
                href={`/families/${post.familySlug}`}
                className="font-display text-lg text-ink hover:text-forest"
              >
                {post.familyName}
              </Link>
            ) : (
              <p className="font-display text-lg text-ink">{post.familyName}</p>
            )}
            <p className="text-sm text-ink-soft">
              {post.authorName ?? "Someone"}
              {post.authorRole === "follower" ? " · collaborator" : null}
              {memoryLabel ? ` · memory ${memoryLabel}` : null}
              {postedLabel ? ` · posted ${postedLabel}` : null}
            </p>
          </div>
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
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-ink-soft">
                Hidden
              </span>
            ) : null}
          </div>
        </header>

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
          <p className="mt-3 whitespace-pre-wrap text-ink leading-relaxed">
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
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition duration-200",
                      mine
                        ? "fc-react-on bg-forest-soft text-forest ring-1 ring-forest/30"
                        : "bg-muted/60 text-ink hover:bg-forest-soft/50",
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

        <footer className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/families/${post.familySlug}/posts/${post.id}`} />
            }
          >
            {post.commentCount === 1
              ? "1 comment"
              : `${post.commentCount} comments`}
          </Button>

          {viewerCanEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}

          {viewerCanDelete ? (
            <form action={deleteAction}>
              <input type="hidden" name="postId" value={post.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={deletePending}
                onClick={(e) => {
                  if (!confirm("Delete this memory?")) e.preventDefault();
                }}
              >
                Delete
              </Button>
            </form>
          ) : null}

          {canModerateFollower && !post.hiddenAt ? (
            <form action={hideAction}>
              <input type="hidden" name="postId" value={post.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={hidePending}
              >
                Hide
              </Button>
            </form>
          ) : null}
          {canModerateFollower && post.hiddenAt ? (
            <form action={unhideAction}>
              <input type="hidden" name="postId" value={post.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={unhidePending}
              >
                Unhide
              </Button>
            </form>
          ) : null}
          {canModerateFollower ? (
            <form action={removeAction}>
              <input type="hidden" name="postId" value={post.id} />
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={removePending}
              >
                Remove
              </Button>
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
