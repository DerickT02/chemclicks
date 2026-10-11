import type { AvailabilityWindow } from "@/lib/assignments/availability";

export type ScheduleStatus = "Open" | "Scheduled" | "Closed" | "Schedule unavailable";

/** Strict calendar validation for UTC schedule input. */
export function parseUtcInput(value: string): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!match) throw new Error("Invalid date.");
  const normalized = `${match[1]}:${match[2] ?? "00"}.${(match[3] ?? "").padEnd(3, "0")}Z`;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== normalized) throw new Error("Invalid date.");
  return normalized;
}

export function toUtcInput(value: string | null): string {
  return value === null ? "" : new Date(value).toISOString().slice(0, -1);
}

/** Browser-local `YYYY-MM-DDTHH:mm` for a stored instant, as datetime-local expects. */
export function toLocalInput(value: string | null): string {
  if (value === null) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Interpret a datetime-local value in the browser's zone; returns an ISO instant, or null when blank. */
export function localInputToInstant(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Enter valid opening and closing dates.");
  return date.toISOString();
}

export function formatUtcTimestamp(value: string): string {
  return `${new Date(value).toISOString().replace("T", " ").replace(/\.000Z$/, "").replace(/Z$/, "")} UTC`;
}

/** Confirm only edits that make currently open work unavailable immediately. */
export function scheduleChangeInterruptsWork(original: AvailabilityWindow, next: AvailabilityWindow, now: number): boolean {
  return scheduleStatus(original, now) === "Open" && ["Scheduled", "Closed"].includes(scheduleStatus(next, now));
}

export function scheduleStatus(window: AvailabilityWindow, now: number): ScheduleStatus {
  const opens = window.opens_at === null ? null : Date.parse(window.opens_at);
  const closes = window.closes_at === null ? null : Date.parse(window.closes_at);
  if (!Number.isFinite(now) || (opens !== null && !Number.isFinite(opens))
    || (closes !== null && !Number.isFinite(closes)) || (opens !== null && closes !== null && opens >= closes)) {
    return "Schedule unavailable";
  }
  if (closes !== null && now >= closes) return "Closed";
  if (opens !== null && now < opens) return "Scheduled";
  return "Open";
}
