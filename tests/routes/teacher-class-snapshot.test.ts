import { describe, expect, it } from "vitest";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";
import { classSnapshotCursor, mergeClassSnapshot, type TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";
import { progressFacts } from "../testing/progress";

const alice = { id: "alice", first_name: "Alice", last_name: "Student", student_id: "A", verified: false };
const bob = { ...alice, id: "bob", first_name: "Bob", student_id: "B" };
const lessonStudent = (row: typeof alice) => ({ studentId: row.id, firstName: row.first_name, lastName: row.last_name,
  verified: row.verified, overallPercent: 0,
  lessons: [{ assignmentId: "assignment", activityId: "activity", activityTitle: "Bohr Models", progress: progressFacts({ stage: "not_started" }) }],
});
const initial: TeacherClassSnapshot = { classId: "class", revision: "1", reset: true, removedStudentIds: [], attempts: null,
  roster: { pending: [alice, bob], active: [] }, progress: { classId: "class", className: "Chemistry", students: [lessonStudent(alice), lessonStudent(bob)] },
};
const emptyDelta: TeacherClassSnapshot = { ...initial, revision: "2", reset: false, roster: { pending: [], active: [] },
  progress: { ...initial.progress!, students: [] },
};

describe("incremental class snapshots", () => {
  it("merges a changed student's approval and progress while retaining all unchanged students", () => {
    const result = mergeClassSnapshot(initial, { ...emptyDelta,
      roster: { pending: [], active: [{ ...alice, verified: true }] },
      progress: { ...initial.progress!, students: [{ ...lessonStudent(alice), verified: true, overallPercent: 100,
        lessons: [{ ...lessonStudent(alice).lessons[0], progress: progressFacts({ stage: "completed" }) }] }] },
    });
    expect(result.roster?.pending.map(row => row.id)).toEqual(["bob"]);
    expect(result.roster?.active.map(row => row.id)).toEqual(["alice"]);
    expect(result.progress?.students).toHaveLength(2);
    expect(result.progress?.students[0].overallPercent).toBe(100);
    expect(result.progress?.students[1]).toBe(initial.progress?.students[1]);
    expect(result.revision).toBe("2");
  });
  it("adds new signups and removes deletions/class transfers from both lists", () => {
    const next = { ...alice, id: "new", first_name: "New", student_id: "N" };
    const result = mergeClassSnapshot(initial, { ...emptyDelta, removedStudentIds: ["alice"],
      roster: { pending: [next], active: [] }, progress: { ...initial.progress!, students: [lessonStudent(next)] },
    });
    expect(result.roster?.pending.map(row => row.id)).toEqual(["bob", "new"]);
    expect(result.progress?.students.map(row => row.studentId)).toEqual(["bob", "new"]);
    expect(result.removedStudentIds).toEqual([]);
  });
  it("fully replaces a stale snapshot after an assignment-wide reset, including empty rosters", () => {
    const result = mergeClassSnapshot(initial, { ...emptyDelta, reset: true });
    expect(result.progress?.students).toEqual([]);
    expect(result.roster).toEqual({ pending: [], active: [] });
  });
  it("returns the exact same object for an unchanged revision", () => {
    expect(mergeClassSnapshot(initial, { ...emptyDelta, revision: "1", roster: null, progress: null })).toBe(initial);
  });
  it("merges incremental attempt overviews without discarding other students", () => {
    const student = (id: string): TeacherActivityAttemptSummary["students"][number] => ({
      studentId: id, firstName: id, lastName: "Student", verified: true, attemptCount: 0,
      completedCount: 0, inProgressCount: 0, explorationAttemptCount: 0, quizAttemptCount: 0,
      quizStartedAt: null, progress: progressFacts({ stage: "not_started" }), attempts: [],
    });
    const summary: TeacherActivityAttemptSummary = { classId: "class", className: "Chemistry", assignmentId: "assignment",
      activityId: "activity", activityTitle: "Bohr Models", students: [student("alice"), student("bob")],
    };
    const before = { ...initial, roster: null, progress: null, attempts: summary };
    const result = mergeClassSnapshot(before, { ...emptyDelta, roster: null, progress: null,
      attempts: { ...summary, students: [{ ...student("alice"), progress: progressFacts({ stage: "quiz_in_progress" }) }] },
    });
    expect(result.attempts?.students).toHaveLength(2);
    expect(result.attempts?.students[0].progress.stage).toBe("quiz_in_progress");
    expect(result.attempts?.students[1]).toBe(summary.students[1]);
  });
  it("keeps the database's order for existing rows and places only new or renamed students", () => {
    // The database sorted "de Silva" before "Davis"; a browser comparator would not.
    const deSilva = { ...alice, id: "de-silva", first_name: "Ana", last_name: "de Silva" };
    const davis = { ...alice, id: "davis", first_name: "Dan", last_name: "Davis" };
    const before: TeacherClassSnapshot = { ...initial, roster: { pending: [deSilva, davis], active: [] },
      progress: { ...initial.progress!, students: [lessonStudent(deSilva), lessonStudent(davis)] } };
    const updated = mergeClassSnapshot(before, { ...emptyDelta,
      roster: { pending: [{ ...davis, student_id: "D2" }], active: [] },
      progress: { ...initial.progress!, students: [{ ...lessonStudent(davis), overallPercent: 50 }] },
    });
    expect(updated.roster?.pending.map(row => row.id)).toEqual(["de-silva", "davis"]);
    expect(updated.progress?.students.map(row => row.studentId)).toEqual(["de-silva", "davis"]);
    const renamed = mergeClassSnapshot(updated, { ...emptyDelta, revision: "3",
      roster: { pending: [{ ...deSilva, last_name: "Zane" }], active: [] },
      progress: { ...initial.progress!, students: [{ ...lessonStudent(deSilva), lastName: "Zane" }] },
    });
    expect(renamed.roster?.pending.map(row => row.id)).toEqual(["davis", "de-silva"]);
    expect(renamed.progress?.students.map(row => row.studentId)).toEqual(["davis", "de-silva"]);
  });
  it("keeps cursor precision and does not add a cursor to an unversioned SSR seed", () => {
    expect(classSnapshotCursor(null)).toBeUndefined();
    expect(classSnapshotCursor({ ...initial, revision: null })).toBeUndefined();
    expect(classSnapshotCursor({ ...initial, revision: "9007199254740993" })).toBe("9007199254740993");
  });
  it("does not merge another class's response", () => {
    expect(() => mergeClassSnapshot(initial, { ...emptyDelta, classId: "other" })).toThrow("mismatch");
  });
});
