"use client";

import { useActionState, useState } from "react";

import {
  createFamilyAction,
  createInviteAction,
  followFamilyAction,
  unfollowFamilyAction,
} from "@/lib/actions/families";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionState = {};

export function CreateFamilyForm() {
  const [state, action, pending] = useActionState(createFamilyAction, initial);

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Circle name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder="The Garcias"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary">Short description (optional)</Label>
        <Textarea
          id="summary"
          name="summary"
          maxLength={280}
          placeholder="Our family memories — cousins welcome"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create circle"}
      </Button>
    </form>
  );
}

export function InviteForm({
  familyId,
  appUrl,
}: {
  familyId: string;
  appUrl: string;
}) {
  const [state, action, pending] = useActionState(createInviteAction, initial);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const inviteUrl = state.success ? `${appUrl}/invite/${state.success}` : null;
  const copied = Boolean(inviteUrl && copiedToken === state.success);

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="familyId" value={familyId} />
        <div className="space-y-2">
          <Label htmlFor="role">Invite as</Label>
          <select
            id="role"
            name="role"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            defaultValue="adult"
          >
            <option value="adult">Family member (adult)</option>
            <option value="follower">Collaborator (follower)</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite link"}
        </Button>
      </form>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {inviteUrl && state.success ? (
        <div className="rounded-lg border border-border bg-card/70 p-3">
          <p className="text-sm text-ink-soft">Share this link (expires in 14 days):</p>
          <p className="mt-1 break-all font-mono text-sm text-ink">{inviteUrl}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl);
              setCopiedToken(state.success!);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function FollowButton({
  familyId,
  isFollowing,
}: {
  familyId: string;
  isFollowing: boolean;
}) {
  const action = isFollowing ? unfollowFamilyAction : followFamilyAction;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="familyId" value={familyId} />
      <Button type="submit" variant={isFollowing ? "outline" : "default"} disabled={pending}>
        {pending
          ? "…"
          : isFollowing
            ? "Unfollow"
            : "Follow as collaborator"}
      </Button>
      {state.error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success && !state.success.startsWith("http") ? (
        <p className="mt-2 text-sm text-forest">{state.success}</p>
      ) : null}
    </form>
  );
}
