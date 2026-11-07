import type { StudentRoster } from "@/lib/server/student-roster";
import type { TeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

export type TeacherClassSnapshot = {
  classId: string;
  // Decimal text avoids losing bigint precision in the browser. Null is an SSR
  // seed without a cursor; its first read establishes an atomic full snapshot.
  revision: string | null;
  reset: boolean;
  removedStudentIds: string[];
  roster: StudentRoster | null;
  progress: TeacherClassLessonProgress | null;
  attempts: TeacherActivityAttemptSummary | null;
};

export function classSnapshotCursor(data: TeacherClassSnapshot | null): string | undefined {
  return data?.revision ?? undefined;
}

// Rows keep the database's order (its collation can differ from the browser's).
// Only new rows, and rows whose name changed, are placed by the comparator.
function mergeOrdered<T>(previous: T[], changes: T[], removed: Set<string>,
  id: (row: T) => string, compare: (a: T, b: T) => number): T[] {
  const changed = new Map(changes.map(row => [id(row), row]));
  const rows: T[] = [];
  const moved: T[] = [];
  for (const row of previous) {
    const key = id(row);
    if (removed.has(key)) continue;
    const next = changed.get(key);
    if (!next) { rows.push(row); continue; }
    changed.delete(key);
    if (compare(row, next) === 0) rows.push(next);
    else moved.push(next);
  }
  for (const row of [...moved, ...changed.values()]) {
    const at = rows.findIndex(existing => compare(row, existing) < 0);
    if (at === -1) rows.push(row);
    else rows.splice(at, 0, row);
  }
  return rows;
}

const byName = (last: string, first: string, key: string, otherLast: string, otherFirst: string, otherKey: string) =>
  last.localeCompare(otherLast) || first.localeCompare(otherFirst) || key.localeCompare(otherKey);

type NamedStudent = { studentId: string; firstName: string; lastName: string };
function mergeStudents<T extends NamedStudent>(previous: T[], changes: T[], removed: Set<string>): T[] {
  return mergeOrdered(previous, changes, removed, row => row.studentId,
    (a, b) => byName(a.lastName, a.firstName, a.studentId, b.lastName, b.firstName, b.studentId));
}

type RosterRow = StudentRoster["pending"][number];
function mergeRosterList(previous: RosterRow[], changes: RosterRow[], removed: Set<string>, verified: boolean): RosterRow[] {
  // A student who changed lists (approval) leaves this one and joins the other.
  const leaving = new Set(removed);
  for (const row of changes) if (Boolean(row.verified) !== verified) leaving.add(row.id);
  return mergeOrdered(previous, changes.filter(row => Boolean(row.verified) === verified), leaving, row => row.id,
    (a, b) => byName(a.last_name, a.first_name, a.id, b.last_name, b.first_name, b.id));
}

export function mergeClassSnapshot(previous: TeacherClassSnapshot | null, delta: TeacherClassSnapshot): TeacherClassSnapshot {
  if (previous && previous.classId !== delta.classId) throw new Error("Class update mismatch");
  if (delta.reset || !previous) return { ...delta, removedStudentIds: [] };
  // An unchanged cursor must not rebuild arrays or re-render either view.
  if (delta.revision === previous.revision) return previous;
  const removed = new Set(delta.removedStudentIds);
  let roster = previous.roster;
  if (delta.roster) {
    const changed = [...delta.roster.pending, ...delta.roster.active];
    roster = {
      pending: mergeRosterList(roster?.pending ?? [], changed, removed, false),
      active: mergeRosterList(roster?.active ?? [], changed, removed, true),
    };
  }
  const progress = delta.progress ? {
    ...delta.progress,
    students: mergeStudents(previous.progress?.students ?? [], delta.progress.students, removed),
  } : previous.progress;
  const attempts = delta.attempts ? {
    ...delta.attempts,
    students: mergeStudents(previous.attempts?.students ?? [], delta.attempts.students, removed),
  } : previous.attempts;
  return { ...delta, reset: true, removedStudentIds: [], roster, progress, attempts };
}
