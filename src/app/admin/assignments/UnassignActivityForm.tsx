"use client";

import { useActionState } from "react";
import {
  unassignActivity,
  type AssignmentFormState,
} from "@/app/admin/assignments/actions";

type Props = {
  classId: string;
  assignmentId: string;
  activityTitle: string;
};

const initialState: AssignmentFormState = {
  status: "idle",
  message: "",
};

const confirmMessage =
  "Archive this assignment for the class? Students will lose access. Progress and attempt records will be kept under Activity attempts. Assigning the same activity again starts a new assignment.";

export default function UnassignActivityForm({
  classId,
  assignmentId,
  activityTitle,
}: Props) {
  const [state, action, pending] = useActionState(
    unassignActivity,
    initialState,
  );

  return (
    <form
      action={action}
      className="flex flex-col items-end gap-1"
      onSubmit={(event) => {
        if (!window.confirm(`${confirmMessage}\n\nActivity: ${activityTitle}`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
      >
        {pending ? "Archiving…" : "Unassign"}
      </button>
      {state.message && state.status === "error" ? (
        <p role="alert" className="max-w-xs text-right text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
