"use client";

import { useActionState } from "react";

import { createAlbumAction, deleteAlbumAction } from "@/lib/actions/albums";
import {
  createPersonAction,
  deletePersonAction,
} from "@/lib/actions/people";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionState = {};

export function CreateAlbumForm({ familyId }: { familyId: string }) {
  const [state, action, pending] = useActionState(createAlbumAction, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="familyId" value={familyId} />
      <div className="space-y-2">
        <Label htmlFor="title">Album title</Label>
        <Input id="title" name="title" required maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" maxLength={500} />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create album"}
      </Button>
    </form>
  );
}

export function DeleteAlbumButton({ albumId }: { albumId: string }) {
  const [state, action, pending] = useActionState(deleteAlbumAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="albumId" value={albumId} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "…" : "Delete album"}
      </Button>
      {state.error ? (
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

export function CreatePersonForm({ familyId }: { familyId: string }) {
  const [state, action, pending] = useActionState(createPersonAction, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="familyId" value={familyId} />
      <div className="space-y-2">
        <Label htmlFor="displayName">Name</Label>
        <Input id="displayName" name="displayName" required maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kind">Adult or kid</Label>
        <select
          id="kind"
          name="kind"
          defaultValue="adult"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="adult">Adult</option>
          <option value="kid">Kid</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="birthday">Birthday (optional)</Label>
        <Input id="birthday" name="birthday" type="date" />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add person"}
      </Button>
      {state.success ? (
        <p className="text-sm text-forest">Added. They can be tagged on memories.</p>
      ) : null}
    </form>
  );
}

export function DeletePersonButton({ personId }: { personId: string }) {
  const [state, action, pending] = useActionState(deletePersonAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="personId" value={personId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Remove
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
