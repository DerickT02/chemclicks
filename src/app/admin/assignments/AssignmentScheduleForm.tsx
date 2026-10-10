"use client";

import { useActionState, useState } from "react";
import {
  saveAssignment,
  type AssignmentFormState,
} from "@/app/admin/assignments/actions";
import UtcScheduleInputs, {
  isoToUtcDatetimeLocal,
} from "@/app/admin/assignments/UtcScheduleInputs";

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

      <UtcScheduleInputs
        opensAt={opensAt}
        closesAt={closesAt}
        onOpensAtChange={setOpensAt}
        onClosesAtChange={setClosesAt}
      />

      <p className="text-xs text-muted-foreground">
        Leave opening blank for immediate availability. Leave closing blank for
        no deadline. Use the clear links if the date picker will not empty the
        field.
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
