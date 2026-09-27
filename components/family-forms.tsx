"use client";

import { useActionState, useState } from "react";

import {
  createFamilyAction,
  createInviteAction,
  followFamilyAction,
  setFollowerCanPostAction,
  unfollowFamilyAction,
} from "@/lib/actions/families";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

type RosterPerson = {
  id: string;
  displayName: string;
  kind: "adult" | "kid";
  birthday: string;
  inviteEmail: string;
};

export function CreateFamilyForm() {
  const [state, action, pending] = useActionState(createFamilyAction, initial);
  const [roster, setRoster] = useState<RosterPerson[]>([]);

  function addPerson() {
    setRoster((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        displayName: "",
        kind: "adult",
        birthday: "",
        inviteEmail: "",
      },
    ]);
  }

  function updatePerson(id: string, patch: Partial<RosterPerson>) {
    setRoster((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function removePerson(id: string) {
    setRoster((prev) => prev.filter((p) => p.id !== id));
  }

  const rosterJson = JSON.stringify(
    roster
      .filter((p) => p.displayName.trim())
      .map((p) => ({
        displayName: p.displayName.trim(),
        kind: p.kind,
        birthday: p.birthday || undefined,
        inviteEmail: p.inviteEmail.trim() || undefined,
      })),
  );

  return (
    <form action={action} className="flex w-full max-w-lg flex-col gap-5">
      <input type="hidden" name="rosterJson" value={rosterJson} />
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

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink">Family roster</h2>
            <p className="text-sm text-ink-soft">
              Add adults and kids now. Adults with an email get an invite link
              you can copy or email.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPerson}>
            Add person
          </Button>
        </div>

        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 px-3 py-4 text-sm text-ink-soft">
            Optional for now — you can always add people later.
          </p>
        ) : (
          <ul className="space-y-3">
            {roster.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border/80 bg-card/50 p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={p.displayName}
                      onChange={(e) =>
                        updatePerson(p.id, { displayName: e.target.value })
                      }
                      placeholder="Name"
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Kind</Label>
                    <select
                      value={p.kind}
                      onChange={(e) =>
                        updatePerson(p.id, {
                          kind: e.target.value as "adult" | "kid",
                        })
                      }
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    >
                      <option value="adult">Adult</option>
                      <option value="kid">Kid</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Birthday (optional)</Label>
                    <Input
                      type="date"
                      value={p.birthday}
                      onChange={(e) =>
                        updatePerson(p.id, { birthday: e.target.value })
                      }
                    />
                  </div>
                  {p.kind === "adult" ? (
                    <div className="space-y-1">
                      <Label>Invite email (optional)</Label>
                      <Input
                        type="email"
                        value={p.inviteEmail}
                        onChange={(e) =>
                          updatePerson(p.id, { inviteEmail: e.target.value })
                        }
                        placeholder="aunt@example.com"
                      />
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => removePerson(p.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
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
  const [email, setEmail] = useState("");

  const inviteUrl = state.success ? `${appUrl}/invite/${state.success}` : null;
  const copied = Boolean(inviteUrl && copiedToken === state.success);
  const mailto =
    inviteUrl && email
      ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Join our family circle")}&body=${encodeURIComponent(`You're invited to our Family Circles circle.\n\nOpen this link to join:\n${inviteUrl}\n`)}`
      : inviteUrl
        ? `mailto:?subject=${encodeURIComponent("Join our family circle")}&body=${encodeURIComponent(`You're invited to our Family Circles circle.\n\nOpen this link to join:\n${inviteUrl}\n`)}`
        : null;

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
        <div className="animate-fc-fade rounded-lg border border-border bg-card/70 p-3">
          <p className="text-sm text-ink-soft">
            Share this link (expires in 14 days):
          </p>
          <p className="mt-1 break-all font-mono text-sm text-ink">{inviteUrl}</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                setCopiedToken(state.success!);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            <div className="space-y-1">
              <Label htmlFor="inviteEmail" className="text-xs">
                Email for mailto
              </Label>
              <Input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional@"
                className="h-8 w-48"
              />
            </div>
            {mailto ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={mailto} />}
              >
                Open email
              </Button>
            ) : null}
          </div>
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
      <Button
        type="submit"
        variant={isFollowing ? "outline" : "default"}
        disabled={pending}
      >
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

export function FollowerCanPostToggle({
  familyId,
  userId,
  canPost,
  name,
}: {
  familyId: string;
  userId: string;
  canPost: boolean;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    setFollowerCanPostAction,
    initial,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="familyId" value={familyId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="canPost" value={canPost ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        title={
          canPost
            ? `Revoke photo posting for ${name}`
            : `Allow ${name} to add photos`
        }
        className={cn(
          "rounded-md px-2 py-1 text-xs transition",
          canPost
            ? "bg-forest-soft text-forest"
            : "bg-muted text-ink-soft hover:bg-forest-soft/50",
        )}
      >
        {pending ? "…" : canPost ? "Can add photos" : "Photos off"}
      </button>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
