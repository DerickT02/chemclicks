import { describe, expect, it } from "vitest";
import { isAssignmentAvailable } from "@/lib/assignments/availability";

const now = Date.parse("2026-09-12T12:00:00Z");

describe("assignment availability", () => {
  it.each([
    [null, null, true],
    ["2026-09-12T12:00:00Z", null, true],
    ["2026-09-12T12:00:00.001Z", null, false],
    [null, "2026-09-12T12:00:00Z", false],
    [null, "2026-09-12T12:00:00.001Z", true],
    ["2026-09-12T11:00:00Z", "2026-09-12T13:00:00Z", true],
    ["2026-09-12T14:00:00+02:00", null, true],
    ["invalid", null, false],
    [null, "invalid", false],
  ])("handles opening %s and closing %s", (opens_at, closes_at, expected) => {
    expect(isAssignmentAvailable({ opens_at, closes_at }, now)).toBe(expected);
  });
});
