import { describe, expect, it } from "vitest";
import type { ActivityType } from "@/lib/db/activities";
import type { StudentAssignment } from "@/lib/db/student-assignments";
import type { AssignmentStage } from "@/lib/assignments/stages";
import {
  assignmentPath,
  isSectionComplete,
  nextSection,
  resolveSequence,
  sectionQuizKey,
  type SectionRecord,
} from "@/lib/assignments/sequence";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();
function section(
  id: string,
  type: string,
  order_index: number,
  window: { opens_at?: string | null; closes_at?: string | null } = {},
): StudentAssignment {
  return {
    id,
    opens_at: window.opens_at ?? null,
    closes_at: window.closes_at ?? null,
    activity: { id: `activity-${id}`, title: `Title ${id}`, type: type as ActivityType, order_index },
  };
}

const record = (
  status: "not_started" | "in_progress" | "completed",
  stage: AssignmentStage,
  explorationCompleted: boolean,
  passingQuizKey: string | null,
): SectionRecord => ({ status, stage, explorationCompleted, passingQuizKey });
const ids = (entries: { assignment: { id: string } }[]) => entries.map((entry) => entry.assignment.id);
const assignmentIds = (assignments: StudentAssignment[]) => assignments.map((assignment) => assignment.id);

describe("sectionQuizKey", () => {
  it.each([
    ["bohr_model_intro", "bohr_model_intro"],
    ["bohr_model_stability", "bohr_model_stability"],
    ["lewis_diagram", "lewis_diagram"],
    ["lewis_structures_covalent", "lewis_covalent"],
    ["lewis_structures_ionic", "lewis_ionic"],
    ["measurement_ruler_tenths", "measurement_ruler_tenths"],
    ["measurement_ruler_hundredths", "measurement_ruler_hundredths"],
    ["measurement_graduated_cylinder_whole", "measurement_cylinder_whole"],
    ["measurement_graduated_cylinder", "measurement_cylinder_tenths"],
  ] as const)("maps %s to %s", (type, key) => {
    expect(sectionQuizKey(type)).toBe(key);
  });
});

describe("isSectionComplete", () => {
  it("uses the database's conjunction result instead of recomputing pass/progress policy", () => {
    expect(isSectionComplete(record("completed", "completed", true, "lewis_covalent"))).toBe(true);
    expect(isSectionComplete(record("in_progress", "exploring", false, "lewis_covalent"))).toBe(false);
    expect(isSectionComplete(record("in_progress", "explored", true, null))).toBe(false);
    expect(isSectionComplete(record("in_progress", "needs_retry", true, null))).toBe(false);
    expect(isSectionComplete(record("in_progress", "exploring", false, null))).toBe(false);
  });

  it("uses the canonical status for no-quiz activities too", () => {
    expect(isSectionComplete(record("completed", "completed", true, null))).toBe(true);
    expect(isSectionComplete(record("in_progress", "explored", true, null))).toBe(false);
  });
});

describe("resolveSequence", () => {
  it("orders by order_index, then id", () => {
    const entries = resolveSequence([
      section("c", "lewis_diagram", 2),
      section("b", "bohr_model_stability", 1),
      section("a", "bohr_model_intro", 1),
    ], new Map(), NOW);

    expect(ids(entries)).toEqual(["a", "b", "c"]);
  });

  it("never locks a section behind an earlier unfinished one", () => {
    const entries = resolveSequence([
      section("first", "bohr_model_intro", 1),
      section("upcoming", "bohr_model_stability", 2, { opens_at: iso(HOUR) }),
      section("later", "lewis_structures_covalent", 3),
    ], new Map(), NOW);

    expect(entries.map((entry) => Object.keys(entry).sort())).toEqual(
      entries.map(() => ["assignment", "complete", "schedule", "state"]),
    );
    expect(entries.map((entry) => entry.schedule)).toEqual(["Open", "Scheduled", "Open"]);
  });

  it("does not mutate the caller's assignment list", () => {
    const assignments = [section("b", "lewis_diagram", 2), section("a", "bohr_model_intro", 1)];
    resolveSequence(assignments, new Map(), NOW);
    expect(assignmentIds(assignments)).toEqual(["b", "a"]);
  });

  it("reports a closed section the student did not finish as incomplete", () => {
    const entries = resolveSequence([
      section("missed", "bohr_model_intro", 1, { closes_at: iso(-HOUR) }),
      section("current", "lewis_diagram", 2),
    ], new Map(), NOW);

    expect(entries[0]).toEqual(expect.objectContaining({ schedule: "Closed", complete: false }));
  });

  it("leaves out assignments without content", () => {
    const entries = resolveSequence([
      section("placeholder", "retired_activity", 0),
      section("real", "bohr_model_intro", 1),
    ], new Map(), NOW);

    expect(ids(entries)).toEqual(["real"]);
  });

  it("ignores records for other assignments", () => {
    const entries = resolveSequence(
      [section("a", "lewis_diagram", 1), section("b", "lewis_diagram", 2)],
      new Map([["someone-else", record("completed", "completed", true, null)]]),
      NOW,
    );
    expect(entries.map((entry) => entry.complete)).toEqual([false, false]);
  });
});

describe("nextSection", () => {
  it("skips finished and not-yet-open sections", () => {
    const entries = resolveSequence([
      section("a", "bohr_model_intro", 1),
      section("b", "bohr_model_stability", 2),
      section("c", "lewis_diagram", 3, { opens_at: iso(HOUR) }),
      section("d", "lewis_structures_covalent", 4),
    ], new Map([
      ["a", record("completed", "completed", true, "bohr_models")],
      ["b", record("completed", "completed", true, "bohr_models")],
    ]), NOW);

    // c has not opened, so d is next even though c is unfinished.
    expect(nextSection(entries, "a")?.assignment.id).toBe("d");
  });

  it("returns the first open unfinished section from canonical state", () => {
    const entries = resolveSequence([
      section("a", "bohr_model_intro", 1),
      section("b", "bohr_model_stability", 2),
      section("c", "lewis_diagram", 3, { closes_at: iso(-HOUR) }),
      section("d", "lewis_structures_covalent", 4),
    ], new Map([
      ["a", record("completed", "completed", true, "bohr_models")],
      ["b", record("in_progress", "exploring", false, null)],
    ]), NOW);

    expect(nextSection(entries, "a")?.assignment.id).toBe("b");
    expect(nextSection(entries, "d")).toBeNull();
    expect(nextSection(entries, "unknown")).toBeNull();
  });
});

describe("the Bohr → Lewis → Measurement journey", () => {
  const journey = [
    section("bohr-intro", "bohr_model_intro", 1),
    section("bohr-stability", "bohr_model_stability", 2),
    section("lewis-diagram", "lewis_diagram", 3),
    section("lewis-covalent", "lewis_structures_covalent", 4),
    section("lewis-ionic", "lewis_structures_ionic", 5),
    section("ruler-tenths", "measurement_ruler_tenths", 6),
    section("ruler-hundredths", "measurement_ruler_hundredths", 7),
    section("cylinder", "measurement_graduated_cylinder", 8),
  ];
  // What finishing each section saves, in order.
  const finish: [string, SectionRecord][] = [
    ["bohr-intro", record("completed", "completed", true, "bohr_models")],
    ["bohr-stability", record("completed", "completed", true, "bohr_models")],
    ["lewis-diagram", record("completed", "completed", true, "lewis_diagram")],
    ["lewis-covalent", record("completed", "completed", true, "lewis_covalent")],
    ["lewis-ionic", record("completed", "completed", true, "lewis_ionic")],
    ["ruler-tenths", record("completed", "completed", true, "measurement_ruler_tenths")],
    ["ruler-hundredths", record("completed", "completed", true, "measurement_ruler_hundredths")],
    ["cylinder", record("completed", "completed", true, "measurement_cylinder_tenths")],
  ];

  it("continues to the next section after each one is finished", () => {
    const records = new Map<string, SectionRecord>();
    for (let step = 0; step < journey.length; step += 1) {
      const [id, saved] = finish[step];
      records.set(id, saved);
      const after = resolveSequence(journey, records, NOW);
      const next = nextSection(after, id);
      expect(next?.assignment.id ?? null).toBe(journey[step + 1]?.id ?? null);
      if (next) expect(assignmentPath(next.assignment)).toBe(`/student/assignments/${journey[step + 1].id}`);
    }
    const done = resolveSequence(journey, records, NOW);
    expect(done.every((entry) => entry.complete)).toBe(true);
  });

  it("lets a later section be finished before an earlier one", () => {
    const records = new Map<string, SectionRecord>([["cylinder", record("completed", "completed", true, "measurement_cylinder_tenths")]]);
    const entries = resolveSequence(journey, records, NOW);
    expect(entries.filter((entry) => entry.complete).map((entry) => entry.assignment.id)).toEqual(["cylinder"]);
    expect(nextSection(entries, "bohr-intro")?.assignment.id).toBe("bohr-stability");
  });
});
