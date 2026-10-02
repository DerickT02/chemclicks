"use client";

import { useActionState, useState } from "react";
import {
  saveAssignment,
  type AssignmentFormState,
} from "@/app/admin/assignments/actions";

type Props = {
  classId: string;
  assignmentId: string;
  activityId: string;
  initialOpensAt: string | null;
  initialClosesAt: string | null;
};

const initialState: AssignmentFormState = {
  status: "idle",
  message: "",
};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-foreground";

function isoToUtcDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 19);
}

export default function AssignmentScheduleForm({
  classId,
  assignmentId,
  activityId,
  initialOpensAt,
  initialClosesAt,
}: Props) {
  const [state, action, pending] = useActionState(
    saveAssignment,
    initialState,
  );
  const [opensAt, setOpensAt] = useState(() =>
    isoToUtcDatetimeLocal(initialOpensAt),
  );
  const [closesAt, setClosesAt] = useState(() =>
    isoToUtcDatetimeLocal(initialClosesAt),
  );

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-border pt-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="activity_id" value={activityId} />

      <p className="text-xs font-medium text-foreground">Adjust schedule (UTC)</p>

      <div className="grid gap-3 sm:grid-cols-2">
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
        Leave opening blank for immediate availability. Leave closing blank for
        no deadline.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save schedule"}
      </button>

      {state.message ? (
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
      ) : null}
    </form>
  );
}
