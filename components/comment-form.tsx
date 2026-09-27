"use client";

import { useActionState } from "react";

import { addCommentAction } from "@/lib/actions/comments";
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
