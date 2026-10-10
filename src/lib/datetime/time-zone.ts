import { formatUtcTimestamp, parseUtcInput } from "@/lib/assignments/schedule";

export type TimeOccurrence = "" | "earlier" | "later";

const formats = new Map<string, Intl.DateTimeFormat>();
export function validateTimeZone(zone: string): void { formatter(zone); }

function formatter(zone: string): Intl.DateTimeFormat {
  const cached = formats.get(zone);
  if (cached) return cached;
  if (!zone || zone.length > 100 || !/^[A-Za-z_][A-Za-z0-9_+\-]*(?:\/[A-Za-z0-9_+\-]+)*$/.test(zone)) throw new Error("Select a valid time zone.");
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, calendar: "gregory", numberingSystem: "latn", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZoneName: "shortOffset",
    });
  } catch { throw new Error("Select a valid time zone."); }
  if (formats.size >= 32) {
    const oldest = formats.keys().next().value;
    if (oldest !== undefined) formats.delete(oldest);
  }
  formats.set(zone, format);
  return format;
}

function wallInput(date: Date, format: Intl.DateTimeFormat): string {
  const parts = new Map(format.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.get("year")!.padStart(4, "0")}-${parts.get("month")}-${parts.get("day")}T${parts.get("hour")}:${parts.get("minute")}:${parts.get("second")}.${String(date.getUTCMilliseconds()).padStart(3, "0")}`;
}

export function toZonedInput(value: string | null, zone: string): string {
  return value === null ? "" : wallInput(new Date(value), formatter(zone));
}

/** Enumerate round-tripping instants; never normalize DST gaps or silently pick a fold. */
export function localTimeCandidates(value: string, zone: string): string[] {
  const format = formatter(zone);
  const nominal = parseUtcInput(value);
  if (nominal === null) return [];
  const wall = Date.parse(nominal);
  const offsets = new Set<number>();
  // Sample both sides of nearby transitions, including half-hour shifts and skipped dates.
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = wall + hours * 3_600_000;
    const date = new Date(sample);
    offsets.add(Date.parse(parseUtcInput(wallInput(date, format))!) - sample);
  }
  return [...offsets].map(offset => new Date(wall - offset))
    .filter(date => wallInput(date, format) === nominal.slice(0, -1))
    .map(date => date.toISOString()).sort();
}

export function parseZonedInput(value: string, zone: string, occurrence: string = ""): string | null {
  if (!["", "earlier", "later"].includes(occurrence)) throw new Error("Select a valid time occurrence.");
  const candidates = localTimeCandidates(value, zone);
  if (!value) return null;
  if (!candidates.length) throw new Error("This local time does not exist because the clocks change. Choose another time.");
  if (candidates.length > 1 && !occurrence) throw new Error("This local time occurs twice. Choose the first or second occurrence.");
  return occurrence === "later" ? candidates[candidates.length - 1] : candidates[0];
}

export function occurrenceForInstant(value: string | null, zone: string): TimeOccurrence {
  if (value === null) return "";
  const candidates = localTimeCandidates(toZonedInput(value, zone), zone);
  if (candidates.length < 2) return "";
  return Date.parse(candidates[0]) === Date.parse(value) ? "earlier" : "later";
}

export function formatZonedTimestamp(value: string, zone: string): string {
  if (zone === "UTC") return formatUtcTimestamp(value);
  const format = formatter(zone);
  const date = new Date(value);
  const offset = format.formatToParts(date).find(part => part.type === "timeZoneName")?.value.replace("GMT", "UTC");
  return `${wallInput(date, format).replace("T", " ").replace(/\.000$/, "")} ${offset} (${zone})`;
}
