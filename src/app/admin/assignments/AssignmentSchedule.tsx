"use client";

import { useActionState, useCallback, useState, useSyncExternalStore } from "react";
import { saveAssignment, type AssignmentFormState } from "@/app/admin/assignments/actions";
import type { ClassActivity } from "@/lib/db/class_activities";
import type { AvailabilityWindow } from "@/lib/assignments/availability";
import { scheduleStatus } from "@/lib/assignments/schedule";
import { occurrenceForInstant, parseZonedInput, toZonedInput, type TimeOccurrence } from "@/lib/datetime/time-zone";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import TimeZoneBoundary from "@/components/datetime/TimeZoneBoundary";
import ScheduleDateField from "@/components/assignments/ScheduleDateField";

type Assignment = Pick<ClassActivity, "id" | "activity_id" | "opens_at" | "closes_at">;
type Props = { classId: string; className: string; activityTitle: string; assignment: Assignment; renderedAt: number };
type EditorState = AssignmentFormState & { responseVersion: number };
const initialState: EditorState = { status: "idle", message: "", responseVersion: 0 };
const keyOf = (window: AvailabilityWindow) => JSON.stringify([window.opens_at, window.closes_at]);

function useScheduleStatus(window: AvailabilityWindow, renderedAt: number) {
  const { opens_at, closes_at } = window;
  const subscribe = useCallback((notify: () => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      clearTimeout(timer);
      notify();
      const now = Date.now();
      const future = [opens_at, closes_at].filter(value => value !== null)
        .map(value => Date.parse(value)).filter(value => Number.isFinite(value) && value > now);
      if (future.length) timer = setTimeout(check, Math.min(Math.min(...future) - now, 2_147_483_647));
    };
    check();
    const interval = setInterval(check, 30_000);
    globalThis.window.addEventListener("focus", check);
    return () => { clearTimeout(timer); clearInterval(interval); globalThis.window.removeEventListener("focus", check); };
  }, [opens_at, closes_at]);
  return useSyncExternalStore(subscribe, () => scheduleStatus(window, Date.now()), () => scheduleStatus(window, renderedAt));
}

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
  const [receipt, setReceipt] = useState<{ base: Assignment; window: AvailabilityWindow; message: string } | null>(null);
  // A confirmed write bridges a failed refresh; genuinely new server props take precedence.
  const window = receipt && receipt.base === assignment ? receipt.window : assignment;
  const [editing, setEditing] = useState<{ window: AvailabilityWindow; serverAssignment: Assignment } | null>(null);
  const status = useScheduleStatus(window, renderedAt);
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
            if (saved) setReceipt({ base: editing.serverAssignment, window: saved, message: `${activityTitle} — ${className}: ${result.message}` });
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

function DateEditor(props: EditorProps) {
  return <TimeZoneBoundary>{zone => <LocalDateEditor {...props} timeZone={zone} />}</TimeZoneBoundary>;
}

function LocalDateEditor({ classId, activityTitle, assignment, original, stale, onCancel, onSaved, timeZone }: EditorProps & { timeZone: string }) {
  const [opensAt, setOpensAt] = useState(toZonedInput(original.opens_at, timeZone));
  const [closesAt, setClosesAt] = useState(toZonedInput(original.closes_at, timeZone));
  const [openOccurrence, setOpenOccurrence] = useState<TimeOccurrence>(occurrenceForInstant(original.opens_at, timeZone));
  const [closeOccurrence, setCloseOccurrence] = useState<TimeOccurrence>(occurrenceForInstant(original.closes_at, timeZone));
  const [reviewing, setReviewing] = useState(false);
  const [validation, setValidation] = useState("");
  const changed = opensAt !== toZonedInput(original.opens_at, timeZone) || closesAt !== toZonedInput(original.closes_at, timeZone)
    || openOccurrence !== occurrenceForInstant(original.opens_at, timeZone) || closeOccurrence !== occurrenceForInstant(original.closes_at, timeZone);
  const [state, action, pending] = useActionState(async (previous: EditorState, data: FormData): Promise<EditorState> => {
    const responseVersion = previous.responseVersion + 1;
    if (!reviewing || stale) return { status: "error", message: "Review the current schedule before saving.", responseVersion };
    let result: AssignmentFormState;
    try { result = await saveAssignment(previous, data); }
    catch { result = { status: "error", message: "We could not confirm the dates were saved. Refresh the page before trying again." }; }
    if (result.status === "success" && result.savedAssignment) onSaved(result);
    return { ...result, responseVersion };
  }, initialState);

  const review = () => {
    try {
      const opens = parseZonedInput(opensAt, timeZone, openOccurrence);
      const closes = parseZonedInput(closesAt, timeZone, closeOccurrence);
      if (opens && closes && opens >= closes) {
        setValidation("The opening date must be earlier than the closing date.");
        return;
      }
      setValidation("");
      setReviewing(true);
    } catch (error) { setValidation(error instanceof Error ? error.message : "Enter valid opening and closing dates."); }
  };

  return (
    <form action={action} aria-label={`Edit dates for ${activityTitle}`} aria-busy={pending} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="activity_id" value={assignment.activity_id} />
      <input type="hidden" name="assignment_id" value={assignment.id} />
      <input type="hidden" name="original_opens_at" value={original.opens_at ?? ""} />
      <input type="hidden" name="original_closes_at" value={original.closes_at ?? ""} />
      <input type="hidden" name="confirm_schedule_change" value={reviewing ? "true" : ""} />
      <input type="hidden" name="schedule_time_zone" value={timeZone} />
      <p className="text-sm font-medium">Edit dates: {activityTitle}</p>
      <p className="text-sm text-muted-foreground">Enter schedule times in {timeZone}. Each date uses its daylight-saving offset. Blank opening means immediate availability; blank closing means no deadline.</p>
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        <ScheduleDateField key={`opens-${state.responseVersion}`} name="opens_at" value={opensAt} zone={timeZone} occurrence={openOccurrence} readOnly={reviewing} showZoneInLabel
          onChange={setOpensAt} onOccurrence={setOpenOccurrence} />
        <ScheduleDateField key={`closes-${state.responseVersion}`} name="closes_at" value={closesAt} zone={timeZone} occurrence={closeOccurrence} readOnly={reviewing} showZoneInLabel
          onChange={setClosesAt} onOccurrence={setCloseOccurrence} />
      </fieldset>
      {stale && <p role="alert" className="text-sm text-destructive">The schedule changed. Cancel and reopen the editor before trying again.</p>}
      {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
      {reviewing && (
        <div className="space-y-2 text-sm">
          <p>Confirm these dates for {activityTitle}? Changes can immediately close, reopen, or interrupt currently open work. Existing exploration attempts will be kept. Closing permits no further submissions.</p>
          <Dates window={{ opens_at: parseZonedInput(opensAt, timeZone, openOccurrence), closes_at: parseZonedInput(closesAt, timeZone, closeOccurrence) }} />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {reviewing ? <>
          <button type="submit" disabled={pending || stale} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">{pending ? "Saving…" : "Confirm save dates"}</button>
          <button type="button" disabled={pending} onClick={() => setReviewing(false)} className="rounded-md border border-border px-3 py-2 text-sm">Back to dates</button>
        </> : <button type="button" disabled={!changed || stale} onClick={review} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50">Review changes</button>}
        <button type="button" disabled={pending} onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button>
      </div>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{state.message}</p>}
    </form>
  );
}
