"use client";

import { useActionState, useState } from "react";
import {
  saveAssignment,
  type AssignmentFormState,
} from "@/app/admin/assignments/actions";
import type { ActivityCatalogEntry } from "@/lib/db/activities";
import type { ClassActivity } from "@/lib/db/class_activities";

type Props = {
  classId: string;
  activities: ActivityCatalogEntry[];
  assignment?: ClassActivity;
};

const initialState: AssignmentFormState = {
  status: "idle",
  message: "",
};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-foreground";

function toUtcInput(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 19) : "";
}

function savedDate(value: string | null, fallback: string): string {
  return value
    ? `${new Date(value).toISOString().slice(0, 19).replace("T", " ")} UTC`
    : fallback;
}

export default function AssignmentForm({
  classId,
  activities,
  assignment,
}: Props) {
  const [state, action, pending] = useActionState(
    saveAssignment,
    initialState,
  );

  const [activityId, setActivityId] = useState(
    assignment?.activity_id ?? "",
  );
  const [opensAt, setOpensAt] = useState(
    toUtcInput(assignment?.opens_at ?? null),
  );
  const [closesAt, setClosesAt] = useState(
    toUtcInput(assignment?.closes_at ?? null),
  );

  const noActivities = !assignment && activities.length === 0;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="class_id" value={classId} />
      <input
        type="hidden"
        name="assignment_id"
        value={assignment?.id ?? ""}
      />

      {assignment ? (
        <input
          type="hidden"
          name="activity_id"
          value={assignment.activity_id}
        />
      ) : (
        <label className="block space-y-1 text-sm">
          <span>Activity</span>
          <select
            name="activity_id"
            required
            value={activityId}
            onChange={(event) => setActivityId(event.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select an activity
            </option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.title} — {activity.description}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="text-sm text-muted-foreground">
        Enter all dates and times in UTC.
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
        Leave opening blank for immediate availability. Leave closing
        blank for no deadline.
      </p>

      {assignment && (
        <div className="text-sm text-muted-foreground">
          <p>
            Saved opening:{" "}
            {savedDate(assignment.opens_at, "Available immediately")}
          </p>
          <p>
            Saved closing:{" "}
            {savedDate(assignment.closes_at, "No deadline")}
          </p>
        </div>
      )}

      {noActivities && (
        <p className="text-sm text-muted-foreground">
          No activities are available to assign.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || noActivities}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : assignment
            ? "Save dates"
            : "Assign activity"}
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
