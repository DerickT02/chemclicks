"use client";

import { useActionState, useState } from "react";
import {
  saveAssignment,
  type AssignmentFormState,
} from "@/app/admin/assignments/actions";
import ActivityCatalog from "@/app/admin/assignments/ActivityCatalog";
import type { ActivityCatalogEntry } from "@/lib/db/activities";

type Props = {
  classId: string;
  activities: ActivityCatalogEntry[];
  assignedActivityIds?: readonly string[];
};

const initialState: AssignmentFormState = {
  status: "idle",
  message: "",
};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-foreground";

export default function AssignmentForm({
  classId,
  activities,
  assignedActivityIds = [],
}: Props) {
  const [state, action, pending] = useActionState(
    saveAssignment,
    initialState,
  );

  const [activityId, setActivityId] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const noActivities = activities.length === 0;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="assignment_id" value="" />
      <ActivityCatalog
        activities={activities}
        assignedActivityIds={assignedActivityIds}
        selectedActivityId={activityId}
        onSelect={setActivityId}
      />

      <p className="text-sm text-muted-foreground">
        Enter optional schedule times in UTC.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Opens at — optional</span>
          <input
            type="datetime-local"
            name="opens_at"
            step="1"
            value={opensAt}
            onChange={(event) => setOpensAt(event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span>Closes at — optional</span>
          <input
            type="datetime-local"
            name="closes_at"
            step="1"
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        Leave opening blank for immediate availability. Leave closing blank
        for no deadline.
      </p>

      <button
        type="submit"
        disabled={pending || noActivities || !activityId}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Assign activity"}
      </button>

      <p
        role={state.status === "error" ? "alert" : "status"}
        className={
          state.status === "error"
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {state.message}
      </p>
    </form>
  );
}
