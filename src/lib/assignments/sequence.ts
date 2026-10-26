import { getActivityDefinition } from "@/lib/activities/registry";
import { hasActivityContent } from "@/lib/assignments/activity-content";
import { LEWIS_QUIZZES, lewisQuizForLesson } from "@/lib/assignments/lewis-quizzes";
import { scheduleStatus, type ScheduleStatus } from "@/lib/assignments/schedule";
import type { ActivityType } from "@/lib/db/activities";
import { BOHR_QUIZ_KEY } from "@/lib/db/quiz-questions";
import type { StudentAssignment } from "@/lib/db/student-assignments";
import type { ProgressStatus } from "@/lib/db/student_progress";
import { measurementQuizModeForActivity } from "@/lib/measurement/modes";

/** The student's own saved state for one assignment. */
export type SectionRecord = {
  progress: ProgressStatus | null;
  passedQuizKeys: ReadonlySet<string>;
};

export type SequenceEntry = {
  assignment: StudentAssignment;
  schedule: ScheduleStatus;
  complete: boolean;
  /** The first earlier section the student still has to finish, if any. */
  lockedBy: StudentAssignment | null;
};

const NO_QUIZZES: ReadonlySet<string> = new Set();

/** The quiz_key a lesson's quiz attempts are saved under, or null when it has none. */
export function sectionQuizKey(type: ActivityType): string | null {
  if (getActivityDefinition(type)?.explorer === "bohr") return BOHR_QUIZ_KEY;
  const lewis = lewisQuizForLesson(type);
  if (lewis) return LEWIS_QUIZZES[lewis].quizKey;
  const mode = measurementQuizModeForActivity(type);
  return mode ? `measurement_${mode.key}` : null;
}

/** Same completion rules as the teacher's lesson progress view (teacher_class_lesson_progress). */
export function isSectionComplete(
  type: ActivityType,
  progress: ProgressStatus | null,
  passedQuizKeys: ReadonlySet<string>,
): boolean {
  const explored = progress === "completed";
  if (getActivityDefinition(type)?.explorer === "bohr") return explored || passedQuizKeys.has(BOHR_QUIZ_KEY);
  const lewis = lewisQuizForLesson(type);
  if (lewis) return explored && passedQuizKeys.has(LEWIS_QUIZZES[lewis].quizKey);
  return explored;
}

/**
 * Orders the student's sections and locks each one behind the first earlier
 * section that is still unfinished. A closed section never blocks (a missed
 * deadline must not lock the rest of the course); a scheduled one does.
 * Assignments without content are left out so a placeholder cannot block.
 */
export function resolveSequence(
  assignments: readonly StudentAssignment[],
  records: ReadonlyMap<string, SectionRecord>,
  now: number,
): SequenceEntry[] {
  let blocker: StudentAssignment | null = null;
  return assignments
    .filter((assignment) => hasActivityContent(assignment.activity.type))
    .sort((a, b) => a.activity.order_index - b.activity.order_index || a.id.localeCompare(b.id))
    .map((assignment) => {
      const schedule = scheduleStatus(assignment, now);
      const record = records.get(assignment.id);
      const complete = isSectionComplete(
        assignment.activity.type,
        record?.progress ?? null,
        record?.passedQuizKeys ?? NO_QUIZZES,
      );
      const entry: SequenceEntry = { assignment, schedule, complete, lockedBy: blocker };
      if (!blocker && !complete && (schedule === "Open" || schedule === "Scheduled")) blocker = assignment;
      return entry;
    });
}

/** The next open, unlocked, unfinished section after the given one. */
export function nextSection(
  entries: readonly SequenceEntry[],
  assignmentId: string,
): SequenceEntry | null {
  const index = entries.findIndex((entry) => entry.assignment.id === assignmentId);
  if (index < 0) return null;
  return entries.slice(index + 1).find(
    (entry) => entry.schedule === "Open" && !entry.lockedBy && !entry.complete,
  ) ?? null;
}

export function assignmentPath(assignment: Pick<StudentAssignment, "id">): string {
  return `/student/assignments/${assignment.id}`;
}
