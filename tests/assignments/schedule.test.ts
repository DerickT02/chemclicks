import { describe, expect, it } from "vitest";
import { parseUtcInput, toUtcInput, scheduleStatus } from "@/lib/assignments/schedule";
const now = Date.parse("2026-09-12T12:00:00Z");
describe("UTC schedule entry and status", () => {
  it("normalizes minutes, seconds, milliseconds, and blank bounds", () => {
    expect(parseUtcInput("")).toBeNull();
    expect(parseUtcInput("2026-09-12T12:34")).toBe("2026-09-12T12:34:00.000Z");
    expect(parseUtcInput("2026-09-12T12:34:56.7")).toBe("2026-09-12T12:34:56.700Z");
    expect(toUtcInput("2026-09-12T08:34:56.789-04:00")).toBe("2026-09-12T12:34:56.789");
    expect(toUtcInput(null)).toBe("");
  });
  it.each(["2026-02-30T12:00", "2026-09-12T25:00", "2026-09-12T12:00Z", "2026-09-12T12:00:00.1234", "invalid"])("rejects invalid or timezone-bearing wall-clock input %s", value => {
    expect(() => parseUtcInput(value)).toThrow("Invalid date.");
  });
  it("uses inclusive opening and exclusive closing, with null bounds", () => {
    expect(scheduleStatus({ opens_at: null, closes_at: null }, now)).toBe("Open");
    expect(scheduleStatus({ opens_at: "2026-09-12T12:00:00Z", closes_at: null }, now - 1)).toBe("Scheduled");
    expect(scheduleStatus({ opens_at: "2026-09-12T12:00:00Z", closes_at: null }, now)).toBe("Open");
    expect(scheduleStatus({ opens_at: null, closes_at: "2026-09-12T12:00:00Z" }, now - 1)).toBe("Open");
    expect(scheduleStatus({ opens_at: null, closes_at: "2026-09-12T12:00:00Z" }, now)).toBe("Closed");
  });
  it("fails closed for malformed, reversed, or equal bounds", () => {
    expect(scheduleStatus({ opens_at: "bad", closes_at: null }, now)).toBe("Schedule unavailable");
    expect(scheduleStatus({ opens_at: "2026-09-12T12:00Z", closes_at: "2026-09-12T12:00Z" }, now)).toBe("Schedule unavailable");
    expect(scheduleStatus({ opens_at: null, closes_at: null }, NaN)).toBe("Schedule unavailable");
  });
});
