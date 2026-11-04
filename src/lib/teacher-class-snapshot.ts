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

type NamedStudent = { studentId: string; firstName: string; lastName: string };
function mergeStudents<T extends NamedStudent>(previous: T[], changes: T[], removed: Set<string>): T[] {
  const rows = new Map(previous.filter(row => !removed.has(row.studentId)).map(row => [row.studentId, row]));
  for (const row of changes) rows.set(row.studentId, row);
  return [...rows.values()].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.studentId.localeCompare(b.studentId));
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
    const rows = new Map([...(roster?.pending ?? []), ...(roster?.active ?? [])]
      .filter(row => !removed.has(row.id)).map(row => [row.id, row]));
    for (const row of changed) rows.set(row.id, row);
    const sorted = [...rows.values()].sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name) || a.id.localeCompare(b.id));
    roster = { pending: sorted.filter(row => !row.verified), active: sorted.filter(row => row.verified) };
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
