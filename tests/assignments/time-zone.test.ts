import { describe, expect, it } from "vitest";
import { formatZonedTimestamp, localTimeCandidates, occurrenceForInstant, parseZonedInput, toZonedInput, validateTimeZone } from "@/lib/datetime/time-zone";
import { isAssignmentAvailable } from "@/lib/assignments/availability";

describe("named-zone schedule conversion", () => {
  it.each([
    ["America/New_York", "2026-09-12T15:00", "2026-09-12T19:00:00.000Z"],
    ["America/Los_Angeles", "2026-09-12T12:00", "2026-09-12T19:00:00.000Z"],
    ["Asia/Kathmandu", "2026-09-12T15:00", "2026-09-12T09:15:00.000Z"],
    ["Asia/Kolkata", "2026-09-12T15:00", "2026-09-12T09:30:00.000Z"],
    ["UTC", "2026-09-12T15:00", "2026-09-12T15:00:00.000Z"],
    ["America/New_York", "2026-01-12T15:00", "2026-01-12T20:00:00.000Z"],
  ])("uses %s's offset on the actual date", (zone, input, expected) => {
    expect(parseZonedInput(input, zone)).toBe(expected);
    expect(toZonedInput(expected, zone)).toBe(`${input}:00.000`);
  });
  it("preserves milliseconds and midnight, independent of the runtime's local zone", () => {
    expect(parseZonedInput("2026-09-12T00:00:00.789", "America/New_York")).toBe("2026-09-12T04:00:00.789Z");
    expect(toZonedInput("2026-09-12T04:00:00.789Z", "America/New_York")).toBe("2026-09-12T00:00:00.789");
  });
  it.each([
    ["America/New_York", "2026-03-08T02:30"],
    ["Australia/Lord_Howe", "2026-10-04T02:15"],
    ["Pacific/Apia", "2011-12-30T12:00"],
  ])("rejects nonexistent %s times rather than normalizing them", (zone, value) => {
    expect(localTimeCandidates(value, zone)).toEqual([]);
    expect(() => parseZonedInput(value, zone)).toThrow("does not exist");
  });
  it.each([
    ["America/New_York", "2026-11-01T01:30", "2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z"],
    ["Europe/London", "2026-10-25T01:30", "2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"],
    ["Australia/Lord_Howe", "2026-04-05T01:45", "2026-04-04T14:45:00.000Z", "2026-04-04T15:15:00.000Z"],
  ])("requires explicit disambiguation in %s, including half-hour folds", (zone, value, earlier, later) => {
    expect(localTimeCandidates(value, zone)).toEqual([earlier, later]);
    expect(() => parseZonedInput(value, zone)).toThrow("occurs twice");
    expect(parseZonedInput(value, zone, "earlier")).toBe(earlier);
    expect(parseZonedInput(value, zone, "later")).toBe(later);
    expect(occurrenceForInstant(earlier, zone)).toBe("earlier");
    expect(occurrenceForInstant(later, zone)).toBe("later");
  });
  it("does not apply wall-clock ordering across a repeated hour", () => {
    const opens = parseZonedInput("2026-11-01T01:45", "America/New_York", "earlier")!;
    const closes = parseZonedInput("2026-11-01T01:15", "America/New_York", "later")!;
    expect(Date.parse(closes)).toBeGreaterThan(Date.parse(opens));
    expect(isAssignmentAvailable({ opens_at: opens, closes_at: closes }, Date.parse(opens))).toBe(true);
    expect(isAssignmentAvailable({ opens_at: opens, closes_at: closes }, Date.parse(closes))).toBe(false);
  });
  it.each(["", "Not/AZone", "+05:30", "../UTC"])("rejects invalid zone %s even for blank dates", zone => {
    expect(() => validateTimeZone(zone)).toThrow("valid time zone");
    expect(() => parseZonedInput("", zone)).toThrow("valid time zone");
  });
  it("retains blank bounds and rejects invalid calendars or occurrence values", () => {
    expect(parseZonedInput("", "America/New_York")).toBeNull();
    expect(() => parseZonedInput("2026-02-30T12:00", "America/New_York")).toThrow("Invalid date");
    expect(() => parseZonedInput("2026-09-12T12:00", "America/New_York", "guess")).toThrow("valid time occurrence");
  });
  it("shows the same instant in different viewers' zones with explicit offsets", () => {
    const instant = "2026-09-12T19:00:00Z";
    expect(formatZonedTimestamp(instant, "America/New_York")).toBe("2026-09-12 15:00:00 UTC-4 (America/New_York)");
    expect(formatZonedTimestamp(instant, "America/Los_Angeles")).toBe("2026-09-12 12:00:00 UTC-7 (America/Los_Angeles)");
    expect(formatZonedTimestamp("2026-01-12T20:00:00Z", "America/New_York")).toContain("UTC-5");
  });
});
