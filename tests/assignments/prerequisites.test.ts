import { describe, expect, it } from "vitest";
import type { ActivityType } from "@/lib/db/activities";
import type { StudentAssignment } from "@/lib/db/student-assignments";
import type { ProgressStatus } from "@/lib/db/student_progress";
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
const none = new Set<string>();

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

const record = (progress: ProgressStatus | null, ...keys: string[]): SectionRecord =>
  ({ progress, passedQuizKeys: new Set(keys) });
const ids = (entries: { assignment: { id: string } }[]) => entries.map((entry) => entry.assignment.id);
const assignmentIds = (assignments: StudentAssignment[]) => assignments.map((assignment) => assignment.id);
const lockedIds = (entries: ReturnType<typeof resolveSequence>) =>
  Object.fromEntries(entries.map((entry) => [entry.assignment.id, entry.lockedBy?.id ?? null]));

describe("sectionQuizKey", () => {
  it.each([
    ["bohr_model_intro", "bohr_models"],
    ["bohr_model_stability", "bohr_models"],
    ["lewis_diagram", null],
    ["lewis_structures_covalent", "lewis_covalent"],
    ["lewis_structures_ionic", "lewis_ionic"],
    ["measurement_ruler_tenths", "measurement_ruler_tenths"],
    ["measurement_ruler_hundredths", "measurement_ruler_hundredths"],
    ["measurement_graduated_cylinder", "measurement_cylinder_tenths"],
  ] as const)("maps %s to %s", (type, key) => {
    expect(sectionQuizKey(type)).toBe(key);
  });
});

describe("isSectionComplete", () => {
  it.each(["bohr_model_intro", "bohr_model_stability"] as const)(
    "%s is complete after the exploration or a passed Bohr quiz",
    (type) => {
      expect(isSectionComplete(type, "completed", none)).toBe(true);
      expect(isSectionComplete(type, "in_progress", new Set(["bohr_models"]))).toBe(true);
      expect(isSectionComplete(type, null, new Set(["bohr_models"]))).toBe(true);
      expect(isSectionComplete(type, "in_progress", new Set(["lewis_covalent"]))).toBe(false);
      expect(isSectionComplete(type, null, none)).toBe(false);
    },
  );

  it.each([
    ["lewis_structures_covalent", "lewis_covalent", "lewis_ionic"],
    ["lewis_structures_ionic", "lewis_ionic", "lewis_covalent"],
  ] as const)("%s needs the exploration and its own passed quiz", (type, own, other) => {
    expect(isSectionComplete(type, "completed", new Set([own]))).toBe(true);
    expect(isSectionComplete(type, "completed", none)).toBe(false);
    expect(isSectionComplete(type, "in_progress", new Set([own]))).toBe(false);
    expect(isSectionComplete(type, "completed", new Set([other]))).toBe(false);
  });

  it.each([
    "lewis_diagram",
    "measurement_ruler_tenths",
    "measurement_ruler_hundredths",
    "measurement_graduated_cylinder",
  ] as const)("%s is complete once its progress is completed", (type) => {
    expect(isSectionComplete(type, "completed", none)).toBe(true);
    expect(isSectionComplete(type, "in_progress", new Set([sectionQuizKey(type) ?? "x"]))).toBe(false);
    expect(isSectionComplete(type, "not_started", none)).toBe(false);
    expect(isSectionComplete(type, null, none)).toBe(false);
  });
});

describe("resolveSequence", () => {
  it("orders by order_index, then id, and locks behind the first unfinished section", () => {
    const entries = resolveSequence([
      section("c", "lewis_diagram", 2),
      section("b", "bohr_model_stability", 1),
      section("a", "bohr_model_intro", 1),
    ], new Map(), NOW);

    expect(ids(entries)).toEqual(["a", "b", "c"]);
    expect(lockedIds(entries)).toEqual({ a: null, b: "a", c: "a" });
  });

  it("does not mutate the caller's assignment list", () => {
    const assignments = [section("b", "lewis_diagram", 2), section("a", "bohr_model_intro", 1)];
    resolveSequence(assignments, new Map(), NOW);
    expect(assignmentIds(assignments)).toEqual(["b", "a"]);
  });

  it("never blocks on a closed section the student did not finish", () => {
    const entries = resolveSequence([
      section("missed", "bohr_model_intro", 1, { closes_at: iso(-HOUR) }),
      section("current", "lewis_diagram", 2),
    ], new Map(), NOW);

    expect(entries[0]).toMatchObject({ schedule: "Closed", complete: false, lockedBy: null });
    expect(lockedIds(entries)).toEqual({ missed: null, current: null });
  });

  it("blocks on an earlier scheduled section that has not opened yet", () => {
    const entries = resolveSequence([
      section("upcoming", "bohr_model_intro", 1, { opens_at: iso(HOUR) }),
      section("open", "lewis_diagram", 2),
    ], new Map(), NOW);

    expect(entries[0].schedule).toBe("Scheduled");
    expect(lockedIds(entries)).toEqual({ upcoming: null, open: "upcoming" });
  });

  it("leaves out assignments without content so a placeholder cannot block", () => {
    const entries = resolveSequence([
      section("placeholder", "retired_activity", 0),
      section("real", "bohr_model_intro", 1),
    ], new Map(), NOW);

    expect(ids(entries)).toEqual(["real"]);
    expect(entries[0].lockedBy).toBeNull();
  });

  it("ignores records for other assignments", () => {
    const entries = resolveSequence(
      [section("a", "lewis_diagram", 1), section("b", "lewis_diagram", 2)],
      new Map([["someone-else", record("completed")]]),
      NOW,
    );
    expect(lockedIds(entries)).toEqual({ a: null, b: "a" });
  });
});

describe("nextSection", () => {
  it("skips finished, locked, and not-yet-open sections", () => {
    const entries = resolveSequence([
      section("a", "bohr_model_intro", 1),
      section("b", "bohr_model_stability", 2),
      section("c", "lewis_diagram", 3, { opens_at: iso(HOUR) }),
      section("d", "lewis_structures_covalent", 4),
    ], new Map([["a", record("completed")], ["b", record("completed")]]), NOW);

    // c is scheduled, and d is locked behind it.
    expect(lockedIds(entries)).toEqual({ a: null, b: null, c: null, d: "c" });
    expect(nextSection(entries, "a")).toBeNull();
  });

  it("returns the next open, unlocked, unfinished section", () => {
    const entries = resolveSequence([
      section("a", "bohr_model_intro", 1),
      section("b", "bohr_model_stability", 2),
      section("c", "lewis_diagram", 3, { closes_at: iso(-HOUR) }),
      section("d", "lewis_structures_covalent", 4),
    ], new Map([["a", record("completed")], ["b", record(null, "bohr_models")]]), NOW);

    expect(nextSection(entries, "a")?.assignment.id).toBe("d");
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
    ["bohr-intro", record("in_progress", "bohr_models")],
    ["bohr-stability", record("completed")],
    ["lewis-diagram", record("completed")],
    ["lewis-covalent", record("completed", "lewis_covalent")],
    ["lewis-ionic", record("completed", "lewis_ionic")],
    ["ruler-tenths", record("completed", "measurement_ruler_tenths")],
    ["ruler-hundredths", record("completed", "measurement_ruler_hundredths")],
    ["cylinder", record("completed", "measurement_cylinder_tenths")],
  ];

  it("unlocks one section at a time and continues to the next", () => {
    const records = new Map<string, SectionRecord>();
    for (let step = 0; step < journey.length; step += 1) {
      const entries = resolveSequence(journey, records, NOW);
      const unlocked = entries.filter((entry) => !entry.lockedBy).map((entry) => entry.assignment.id);
      expect(unlocked).toEqual(assignmentIds(journey.slice(0, step + 1)));
      entries.slice(step + 1).forEach((entry) => expect(entry.lockedBy?.id).toBe(journey[step].id));

      const [id, saved] = finish[step];
      records.set(id, saved);
      const after = resolveSequence(journey, records, NOW);
      const next = nextSection(after, id);
      expect(next?.assignment.id ?? null).toBe(journey[step + 1]?.id ?? null);
      if (next) expect(assignmentPath(next.assignment)).toBe(`/student/assignments/${journey[step + 1].id}`);
    }
    const done = resolveSequence(journey, records, NOW);
    expect(done.every((entry) => entry.complete && !entry.lockedBy)).toBe(true);
  });

  it("keeps a Lewis lesson blocking until its quiz is passed", () => {
    const records = new Map<string, SectionRecord>(finish.slice(0, 3));
    records.set("lewis-covalent", record("completed"));
    const entries = resolveSequence(journey, records, NOW);
    expect(entries.find((entry) => entry.assignment.id === "lewis-ionic")?.lockedBy?.id).toBe("lewis-covalent");
  });
});
