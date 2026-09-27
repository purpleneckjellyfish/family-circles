"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  hideFollowerPostAction,
  removeFollowerPostAction,
  unhidePostAction,
} from "@/lib/actions/posts";
import type { ActionState } from "@/lib/actions/auth";
import type { FeedPost } from "@/lib/feed";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui-states";
import { MemoryPhoto } from "@/components/memory-photo";

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

export function PostCard({
  post,
  viewerCanModerate,
  showFamilyLink = true,
  index = 0,
}: {
  post: FeedPost;
  viewerCanModerate: boolean;
  showFamilyLink?: boolean;
  /** Stagger entrance when listing many cards. */
  index?: number;
}) {
  const canModerateFollower =
    viewerCanModerate && post.authorRole === "follower";
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

  const memoryLabel = formatDate(post.memoryDate);
  const postedLabel = formatDate(post.postedAt);
  const hasPhotos = post.media.length > 0;
  const actionError =
    hideState.error || unhideState.error || removeState.error;

  return (
    <article
      className="animate-fc-rise overflow-hidden rounded-xl border border-border/80 bg-card/60 shadow-[0_18px_40px_-32px_rgba(31,26,20,0.45)] transition-[border-color,box-shadow] duration-300 hover:border-forest/35"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      {/* Photos lead when present — editorial album, not caption-first chrome. */}
      {hasPhotos ? (
        <div
          className={
            post.media.length === 1
              ? "grid grid-cols-1"
              : post.media.length === 2
                ? "grid grid-cols-2 gap-px bg-border/60"
                : "grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-3"
          }
        >
          {post.media.map((m, i) => (
            <MemoryPhoto
              key={m.id}
              src={`/api/media/${m.id}`}
              href={`/api/media/${m.id}`}
              className={
                post.media.length === 1
                  ? "min-h-[14rem] sm:min-h-[18rem]"
                  : i === 0 && post.media.length > 2
                    ? "col-span-2 min-h-[12rem] sm:col-span-1 sm:min-h-[14rem]"
                    : "min-h-[10rem] sm:min-h-[12rem]"
              }
              imgClassName={
                post.media.length === 1 ? "max-h-[28rem]" : "max-h-none h-full"
              }
            />
          ))}
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
          {post.hiddenAt ? (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-ink-soft">
              Hidden
            </span>
          ) : null}
        </header>

        {post.body ? (
          <p className="mt-3 whitespace-pre-wrap text-ink leading-relaxed">
            {post.body}
          </p>
        ) : null}

        {(post.people.length > 0 || post.albums.length > 0) && (
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
        )}

        <footer className="mt-4 flex flex-wrap items-center gap-3">
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
