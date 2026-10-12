"use client";

import { useActionState, useState } from "react";
import { saveAssignment, type AssignmentFormState } from "@/app/admin/assignments/actions";
import type { ClassActivity } from "@/lib/db/class_activities";
import type { AvailabilityWindow } from "@/lib/assignments/availability";
import { localInputToInstant, scheduleChangeInterruptsWork, scheduleStatus, toLocalInput, toUtcInput } from "@/lib/assignments/schedule";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import ScheduleDateField from "@/components/assignments/ScheduleDateField";

type Assignment = Pick<ClassActivity, "id" | "activity_id" | "opens_at" | "closes_at">;
type Props = { classId: string; className: string; activityTitle: string; assignment: Assignment; renderedAt: number };
type EditorState = AssignmentFormState & { responseVersion: number };
const initialState: EditorState = { status: "idle", message: "", responseVersion: 0 };
const keyOf = (window: AvailabilityWindow) => JSON.stringify([window.opens_at, window.closes_at]);

function Dates({ window }: { window: AvailabilityWindow }) {
  return (
    <dl className="space-y-1 text-xs text-muted-foreground">
      {([ ["Opens", window.opens_at, "Available immediately"], ["Closes", window.closes_at, "No deadline"] ] as const).map(([label, value, empty]) => (
        <div key={label} className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-foreground/80">{label}</dt>
          <dd>{value === null ? empty : Number.isFinite(Date.parse(value))
            ? <LocalizedTimestamp value={value} /> : "Date unavailable"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AssignmentSchedule({ classId, className, activityTitle, assignment, renderedAt }: Props) {
  const serverKey = keyOf(assignment);
  const [receipt, setReceipt] = useState<{ base: Assignment; window: AvailabilityWindow; message: string; checkedAt: number } | null>(null);
  // A confirmed write bridges a failed refresh; genuinely new server props take precedence.
  const window = receipt && receipt.base === assignment ? receipt.window : assignment;
  const [editing, setEditing] = useState<{ window: AvailabilityWindow; serverAssignment: Assignment } | null>(null);
  const status = scheduleStatus(window, receipt?.base === assignment ? receipt.checkedAt : renderedAt);
  const receiptIsCurrent = receipt && (receipt.base === assignment || keyOf(receipt.window) === serverKey);

  return (
    <div className="mt-3 space-y-3">
      <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">{status}</span>
      <Dates window={window} />
      {receiptIsCurrent && <p role="status" className="text-sm text-muted-foreground">{receipt.message}</p>}
      {editing ? (
        <DateEditor classId={classId} activityTitle={activityTitle} assignment={assignment}
          original={editing.window} stale={keyOf(editing.window) !== keyOf(window)}
          onCancel={() => setEditing(null)}
          onSaved={(result) => {
            const saved = result.savedAssignment;
            if (saved) setReceipt({ base: editing.serverAssignment, window: saved, message: `${activityTitle} — ${className}: ${result.message}`, checkedAt: Date.now() });
            setEditing(null);
          }} />
      ) : (
        <button type="button" disabled={status === "Schedule unavailable"}
          onClick={() => setEditing({ window: { opens_at: window.opens_at, closes_at: window.closes_at }, serverAssignment: assignment })}
          aria-label={`Edit dates for ${activityTitle}`}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50">
          Edit dates
        </button>
      )}
    </div>
  );
}

type EditorProps = {
  classId: string; activityTitle: string; assignment: Assignment; original: AvailabilityWindow; stale: boolean;
  onCancel: () => void; onSaved: (result: AssignmentFormState) => void;
};

function DateEditor({ classId, activityTitle, assignment, original, stale, onCancel, onSaved }: EditorProps) {
  const initialOpens = toLocalInput(original.opens_at);
  const initialCloses = toLocalInput(original.closes_at);
  const [opensAt, setOpensAt] = useState(initialOpens);
  const [closesAt, setClosesAt] = useState(initialCloses);
  const [confirming, setConfirming] = useState(false);
  const changed = opensAt !== initialOpens || closesAt !== initialCloses;
  const [state, action, pending] = useActionState(async (previous: EditorState, data: FormData): Promise<EditorState> => {
    const responseVersion = previous.responseVersion + 1;
    if (stale) return { status: "error", message: "The schedule changed. Cancel and reopen the editor.", responseVersion };
    try {
      // An untouched field keeps its stored instant; the minute-precision input cannot represent its seconds.
      const next = {
        opens_at: opensAt === initialOpens ? original.opens_at : localInputToInstant(opensAt),
        closes_at: closesAt === initialCloses ? original.closes_at : localInputToInstant(closesAt),
      };
      if (next.opens_at && next.closes_at && Date.parse(next.opens_at) >= Date.parse(next.closes_at)) {
        return { status: "error", message: "The opening date must be earlier than the closing date.", responseVersion };
      }
      if (!confirming && scheduleChangeInterruptsWork(original, next, Date.now())) {
        setConfirming(true);
        return { ...initialState, responseVersion };
      }
      data.set("opens_at", next.opens_at === null ? "" : toUtcInput(next.opens_at));
      data.set("closes_at", next.closes_at === null ? "" : toUtcInput(next.closes_at));
    } catch {
      return { status: "error", message: "Enter valid opening and closing dates.", responseVersion };
    }
    let result: AssignmentFormState;
    try { result = await saveAssignment(previous, data); }
    catch { result = { status: "error", message: "We could not confirm the dates were saved. Refresh the page before trying again." }; }
    if (result.requiresConfirmation) {
      setConfirming(true);
      return { ...initialState, responseVersion };
    }
    if (result.status === "success" && result.savedAssignment) onSaved(result);
    return { ...result, responseVersion };
  }, initialState);

  return (
    <form action={action} aria-label={`Edit dates for ${activityTitle}`} aria-busy={pending} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="activity_id" value={assignment.activity_id} />
      <input type="hidden" name="assignment_id" value={assignment.id} />
      <input type="hidden" name="original_opens_at" value={original.opens_at ?? ""} />
      <input type="hidden" name="original_closes_at" value={original.closes_at ?? ""} />
      <input type="hidden" name="confirm_schedule_change" value={confirming ? "true" : ""} />
      <p className="text-sm font-medium">Edit dates: {activityTitle}</p>
      <p className="text-sm text-muted-foreground">Times use this device&apos;s time zone. Blank opening means immediate availability; blank closing means no deadline.</p>
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <ScheduleDateField key={`opens-${state.responseVersion}`} name="opens_at" value={opensAt} readOnly={confirming} onChange={setOpensAt} />
        <ScheduleDateField key={`closes-${state.responseVersion}`} name="closes_at" value={closesAt} readOnly={confirming} onChange={setClosesAt} />
      </fieldset>
      {stale && <p role="alert" className="text-sm text-destructive">The schedule changed. Cancel and reopen the editor before trying again.</p>}
      {confirming && <p role="alert" className="text-sm">These dates will make this activity unavailable immediately. Confirm to stop further submissions. Existing exploration attempts will be kept.</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={!changed || pending || stale} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">{pending ? "Saving…" : confirming ? "Confirm save dates" : "Save dates"}</button>
        {confirming && <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="rounded-md border border-border px-3 py-2 text-sm">Back to dates</button>}
        <button type="button" disabled={pending} onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button>
      </div>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{state.message}</p>}
    </form>
  );
}
