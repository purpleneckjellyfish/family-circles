"use client";

import { useActionState } from "react";

import {
  createMilestoneAction,
  deleteMilestoneAction,
} from "@/lib/actions/milestones";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

export function CreateMilestoneForm({
  familyId,
  people,
}: {
  familyId: string;
  people: Array<{ id: string; displayName: string }>;
}) {
  const [state, action, pending] = useActionState(createMilestoneAction, initial);

  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="familyId" value={familyId} />
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="Wedding day"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kind">Type</Label>
        <select
          id="kind"
          name="kind"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          defaultValue="anniversary"
        >
          <option value="anniversary">Anniversary</option>
          <option value="other">Other milestone</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="occursOn">Original date</Label>
        <Input id="occursOn" name="occursOn" type="date" required />
        <p className="text-sm text-ink-soft">
          Throwbacks match the month and day every year.
        </p>
      </div>
      {people.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="personId">Linked person (optional)</Label>
          <select
            id="personId"
            name="personId"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            defaultValue=""
          >
            <option value="">None</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add milestone"}
      </Button>
      {state.success ? (
        <p className="text-sm text-forest">Saved — it will appear on that day.</p>
      ) : null}
    </form>
  );
}

export function DeleteMilestoneButton({ milestoneId }: { milestoneId: string }) {
  const [state, action, pending] = useActionState(deleteMilestoneAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Remove
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
