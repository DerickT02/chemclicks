"use client";

import { useActionState, useState } from "react";
import {
  saveAssignment,
  type AssignmentFormState,
} from "@/app/admin/assignments/actions";
import ActivityCatalog from "@/app/admin/assignments/ActivityCatalog";
import type { ActivityCatalogEntry } from "@/lib/db/activities";
import { canAssignActivity } from "@/lib/activities/registry";
import ScheduleDateField from "@/components/assignments/ScheduleDateField";
import { localInputToInstant, toUtcInput } from "@/lib/assignments/schedule";

type Props = {
  classId: string;
  className?: string;
  activities: ActivityCatalogEntry[];
  assignedActivityIds?: readonly string[];
};

type ClientFormState = AssignmentFormState & { responseVersion: number };
const initialState: ClientFormState = {
  status: "idle",
  message: "",
  responseVersion: 0,
};

export default function AssignmentForm({
  classId,
  className = "this class",
  activities,
  assignedActivityIds = [],
}: Props) {
  const [activityId, setActivityId] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  // Assigned activities are managed from the assigned list, not offered again here.
  const availableActivities = activities.filter((activity) => !assignedActivityIds.includes(activity.id));
  const selectedActivity = availableActivities.find((activity) => activity.id === activityId);
  const selectionIsAssignable = Boolean(selectedActivity && canAssignActivity(selectedActivity.type));
  const [state, action, pending] = useActionState(async (previous: ClientFormState, data: FormData): Promise<ClientFormState> => {
    const responseVersion = previous.responseVersion + 1;
    try {
      // The browser interprets entered times in its own zone; the server receives UTC.
      for (const name of ["opens_at", "closes_at"]) {
        const instant = localInputToInstant(String(data.get(name) ?? ""));
        data.set(name, instant === null ? "" : toUtcInput(instant));
      }
    } catch {
      return { status: "error", message: "Enter valid opening and closing dates.", responseVersion };
    }
    let result: AssignmentFormState;
    try { result = await saveAssignment(previous, data); }
    catch { result = { status: "error", message: "We could not confirm the assignment was saved. Refresh the page before trying again." }; }
    if (result.status === "success") {
      const title = activities.find(activity => activity.id === data.get("activity_id"))?.title ?? "Activity";
      setActivityId("");
      setOpensAt("");
      setClosesAt("");
      return { ...result, responseVersion, message: `${title} — ${className}: ${result.message}` };
    }
    return { ...result, responseVersion };
  }, initialState);

  return (
    <form action={action} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="assignment_id" value="" />
      <fieldset disabled={pending} className="space-y-4">
        {/* Reassert controlled radios after React's native form reset, including repeat errors. */}
        <ActivityCatalog
          key={state.responseVersion}
          activities={availableActivities}
          totalCatalogCount={activities.length}
          selectedActivityId={selectionIsAssignable ? activityId : ""}
          onSelect={setActivityId}
        />

        <p className="text-sm text-muted-foreground">
          Times use this device&apos;s time zone.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <ScheduleDateField key={`opens-${state.responseVersion}`} name="opens_at" value={opensAt} onChange={setOpensAt} />
          <ScheduleDateField key={`closes-${state.responseVersion}`} name="closes_at" value={closesAt} onChange={setClosesAt} />
        </div>

        <p className="text-xs text-muted-foreground">
          Leave opening blank for immediate availability. Leave closing blank
          for no deadline.
        </p>
      </fieldset>
      <button
        type="submit"
        disabled={pending || !selectionIsAssignable}
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
