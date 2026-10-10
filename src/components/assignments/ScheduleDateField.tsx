"use client";

import { useId } from "react";
import { localTimeCandidates, type TimeOccurrence } from "@/lib/datetime/time-zone";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";

type Props = {
  name: "opens_at" | "closes_at"; value: string; zone: string; occurrence: TimeOccurrence; readOnly?: boolean; showZoneInLabel?: boolean;
  onChange: (value: string) => void; onOccurrence: (value: TimeOccurrence) => void;
};
export default function ScheduleDateField({ name, value, zone, occurrence, readOnly, showZoneInLabel, onChange, onOccurrence }: Props) {
  const errorId = useId();
  let candidates: string[] = [];
  let error = "";
  try {
    candidates = localTimeCandidates(value, zone);
    if (value && !candidates.length) error = "This time does not exist because the clocks change. Choose another time.";
  } catch { if (value) error = "Enter a valid date and time."; }
  const label = name === "opens_at" ? "Opens at" : "Closes at";
  return <div className="space-y-2">
    <label className="block space-y-1 text-sm"><span>{label}{showZoneInLabel ? ` (${zone})` : ""} — optional</span>
      <input type="datetime-local" step="0.001" name={name} value={value} readOnly={readOnly}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        ref={node => { node?.setCustomValidity(error); }}
        onChange={event => { onChange(event.target.value); onOccurrence(""); }}
        className="min-w-0 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground" /></label>
    <input type="hidden" name={`${name}_occurrence`} value={occurrence} />
    {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
    {candidates.length > 1 && <label className="block space-y-1 text-sm">
      <span>{label}: choose which repeated time</span>
      <select value={occurrence} required disabled={readOnly}
        ref={node => {
          // React actions reset native forms. Mirror the chosen occurrence into reset defaults.
          if (node) for (const option of node.options) option.defaultSelected = option.value === occurrence;
        }}
        onChange={event => onOccurrence(event.target.value as TimeOccurrence)}
        className="w-full rounded-md border border-border bg-background px-3 py-2">
        <option value="">Choose an occurrence</option>
        <option value="earlier">First occurrence — {candidates[0]}</option>
        <option value="later">Second occurrence — {candidates[candidates.length - 1]}</option>
      </select>
    </label>}
    {candidates.length === 1 && <p className="text-xs text-muted-foreground">Will save: <LocalizedTimestamp value={candidates[0]} /></p>}
  </div>;
}
