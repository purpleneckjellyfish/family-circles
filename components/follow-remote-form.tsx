"use client";

import { useActionState } from "react";

import { followRemoteFamilyAction } from "@/lib/actions/federation";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

export function FollowRemoteForm() {
  const [state, action, pending] = useActionState(
    followRemoteFamilyAction,
    initial,
  );

  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <div className="space-y-2">
        <Label htmlFor="remoteUrl">Remote circle URL</Label>
        <Input
          id="remoteUrl"
          name="remoteUrl"
          placeholder="https://other.example/families/smith or acct:smith@other.example"
          required
        />
        <p className="text-sm text-ink-soft">
          Follows another Family Circles host over ActivityPub. You need a local
          circle first (Follow is sent as that actor). HTTPS required in
          production.
        </p>
      </div>
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state.success ? (
        <p className="text-sm text-forest" role="status">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Following…" : "Follow remote circle"}
      </Button>
    </form>
  );
}
