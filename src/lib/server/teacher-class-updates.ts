import "server-only";
import { createServiceClient } from "@/lib/server/database";
import { requireTeacherId } from "@/lib/server/teacher";
import { getOwnedStudentRoster } from "@/lib/server/student-roster";
import {
  getTeacherActivityAttemptSummary, MISSING_FUNCTION, normalizeTeacherActivityAttemptSummary, type AttemptSummaryResponse,
} from "@/lib/server/teacher-attempts";
import {
  getTeacherClassLessonProgress, normalizeTeacherClassLessonProgress, type LessonProgressResponse,
} from "@/lib/server/teacher-lesson-progress";
import type { TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function isClassUpdateCursor(value: string): boolean {
  return /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= BigInt("9223372036854775807");
}

export async function getTeacherClassUpdates(classId: string, options: {
  after?: string;
  assignmentId?: string;
} = {}): Promise<TeacherClassSnapshot> {
  const teacherId = await requireTeacherId();
  if (!UUID.test(classId) || (options.assignmentId !== undefined && !UUID.test(options.assignmentId))
    || (options.after !== undefined && !isClassUpdateCursor(options.after))) throw new Error("Invalid class update request.");
  // One verification, one RPC. The RPC independently checks ownership and reads
  // the revision, membership and requested rows in one database snapshot.
  const { data, error } = await createServiceClient().rpc("teacher_class_updates", {
    p_teacher_id: teacherId, p_class_id: classId,
    p_after: options.after ?? null, p_assignment_id: options.assignmentId ?? null,
  });
  if (error?.code === MISSING_FUNCTION) return fullClassSnapshot(classId, options.assignmentId);
  if (error || !data) throw new Error("Class updates access denied or unavailable.");
  const snapshot = data as Omit<TeacherClassSnapshot, "progress" | "attempts"> & {
    progress: LessonProgressResponse | null;
    attempts: AttemptSummaryResponse | null;
  };
  // The same boundary normalization as the direct reads, so merged rows match the seed.
  return {
    ...snapshot,
    progress: snapshot.progress ? normalizeTeacherClassLessonProgress(snapshot.progress) : null,
    attempts: snapshot.attempts ? normalizeTeacherActivityAttemptSummary(snapshot.attempts) : null,
  };
}

// Databases without 20261105040000 have no revisions: every read is a full,
// cursorless snapshot from the existing ownership-checked reads.
async function fullClassSnapshot(classId: string, assignmentId?: string): Promise<TeacherClassSnapshot> {
  const [roster, progress, attempts] = await Promise.all([
    getOwnedStudentRoster(classId),
    getTeacherClassLessonProgress(classId),
    assignmentId === undefined ? null : getTeacherActivityAttemptSummary(classId, assignmentId, { live: true }),
  ]);
  return { classId, revision: null, reset: true, removedStudentIds: [], roster, progress, attempts };
}
