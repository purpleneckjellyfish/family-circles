"use client";

import { useActionState, useState } from "react";

import {
  addCommentAction,
  deleteCommentAction,
  updateCommentAction,
} from "@/lib/actions/comments";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionState = {};

export function CommentForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState(addCommentAction, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="postId" value={postId} />
      <Textarea
        name="body"
        required
        rows={3}
        maxLength={2000}
        placeholder="Add a comment…"
      />
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Posting…" : "Comment"}
      </Button>
    </form>
  );
}

export function CommentListItem({
  comment,
  canEdit,
  canDelete,
}: {
  comment: {
    id: string;
    body: string;
    createdAt: Date;
    authorName: string | null;
  };
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCommentAction,
    initial,
  );

  return (
    <li className="rounded-lg border border-border/70 bg-card/50 px-4 py-3">
      <p className="text-sm text-ink-soft">
        {comment.authorName ?? "Someone"} ·{" "}
        {comment.createdAt.toLocaleString()}
      </p>
      {editing ? (
        <form
          className="mt-2 space-y-2"
          action={async (fd) => {
            setEditPending(true);
            setEditError(null);
            const result = await updateCommentAction({}, fd);
            setEditPending(false);
            if (result.error) {
              setEditError(result.error);
              return;
            }
            setEditing(false);
          }}
        >
          <input type="hidden" name="commentId" value={comment.id} />
          <Textarea
            name="body"
            required
            rows={3}
            maxLength={2000}
            defaultValue={comment.body}
          />
          {editError ? (
            <p className="text-sm text-destructive">{editError}</p>
          ) : null}
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
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-ink">{comment.body}</p>
      )}
      {(canEdit || canDelete) && !editing ? (
        <div className="mt-2 flex gap-2">
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <form action={deleteAction}>
              <input type="hidden" name="commentId" value={comment.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={deletePending}
                onClick={(e) => {
                  if (!confirm("Delete this comment?")) e.preventDefault();
                }}
              >
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {deleteState.error ? (
        <p className="mt-2 text-sm text-destructive">{deleteState.error}</p>
      ) : null}
    </li>
  );
}
