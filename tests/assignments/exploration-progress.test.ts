import { describe, expect, it } from "vitest";
import { summarizeCurrentExplorations } from "@/lib/assignments/exploration-progress";
import type { ProgressStatus } from "@/lib/db/student_progress";

const assignments = ["a", "b", "c", "d", "e"];
const row = (class_activity_id: string, status: ProgressStatus = "completed") => ({ class_activity_id, status });

describe("current exploration summary", () => {
  it("counts one completion out of five assignments, including missing progress", () => {
    expect(summarizeCurrentExplorations(assignments, [row("a")])).toEqual({
      assigned: 5, completed: 1, inProgress: 0, notStarted: 4, percent: 20,
    });
  });
  it("counts explicit and missing not-started states together", () => {
    expect(summarizeCurrentExplorations(assignments, [row("a"), row("b", "in_progress"), row("c", "not_started")]))
      .toEqual({ assigned: 5, completed: 1, inProgress: 1, notStarted: 3, percent: 20 });
  });
  it("uses the latest stored progress state during a retry, not historical completion", () => {
    expect(summarizeCurrentExplorations(["a"], [row("a", "in_progress")]))
      .toEqual({ assigned: 1, completed: 0, inProgress: 1, notStarted: 0, percent: 0 });
  });
  it("does not choose a current activity from query order", () => {
    const rows = [row("b", "in_progress"), row("a"), row("c", "not_started")];
    expect(summarizeCurrentExplorations(assignments, rows)).toEqual(summarizeCurrentExplorations(assignments, [...rows].reverse()));
  });
  it("ignores unrelated/deleted assignment rows and deduplicates identical records", () => {
    expect(summarizeCurrentExplorations(["a", "a", "b"], [row("foreign"), row("a"), row("a")]))
      .toEqual({ assigned: 2, completed: 1, inProgress: 0, notStarted: 1, percent: 50 });
  });
  it.each([
    [row("a"), row("a", "in_progress")],
    [row("a", "invalid" as ProgressStatus)],
  ])("does not fabricate counts from conflicting or invalid progress", (...rows) => {
    expect(summarizeCurrentExplorations(assignments, rows)).toBeNull();
  });
  it("has no percentage when nothing is assigned", () => {
    expect(summarizeCurrentExplorations([], [row("old")]))
      .toEqual({ assigned: 0, completed: 0, inProgress: 0, notStarted: 0, percent: null });
  });
});
