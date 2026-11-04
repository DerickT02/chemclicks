import { hasActivityContent } from "@/lib/assignments/activity-content";
import { LEWIS_QUIZZES, lewisQuizForLesson } from "@/lib/assignments/lewis-quizzes";
import { scheduleStatus, type ScheduleStatus } from "@/lib/assignments/schedule";
import type { ActivityType } from "@/lib/db/activities";
import { BOHR_INTRO_QUIZ_KEY, BOHR_QUIZ_KEY, BOHR_STABILITY_QUIZ_KEY } from "@/lib/db/quiz-questions";
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
};

const NO_QUIZZES: ReadonlySet<string> = new Set();

function isBohrLesson(type: ActivityType): boolean {
  return type === "bohr_model_intro" || type === "bohr_model_stability";
}

/** The quiz_key a lesson's quiz attempts are saved under, or null when it has none. */
export function sectionQuizKey(type: ActivityType): string | null {
  if (type === "bohr_model_intro") return BOHR_INTRO_QUIZ_KEY;
  if (type === "bohr_model_stability") return BOHR_STABILITY_QUIZ_KEY;
  const lewis = lewisQuizForLesson(type);
  if (lewis) return LEWIS_QUIZZES[lewis].quizKey;
  const mode = measurementQuizModeForActivity(type);
  return mode ? `measurement_${mode.key}` : null;
}

/**
 * A section with a quiz is complete once that quiz is passed; one without a
 * quiz is complete once its exploration is finished. Same rule as the
 * teacher views (public.assignment_progress_state).
 */
export function isSectionComplete(
  type: ActivityType,
  progress: ProgressStatus | null,
  passedQuizKeys: ReadonlySet<string>,
): boolean {
  const quizKey = sectionQuizKey(type);
  if (!quizKey) return progress === "completed";
  // Bohr passes saved under the legacy shared key still count for either lesson.
  if (isBohrLesson(type) && passedQuizKeys.has(BOHR_QUIZ_KEY)) return true;
  return passedQuizKeys.has(quizKey);
}

/**
 * Orders the student's sections and marks each one complete or not. Sections
 * are never locked behind earlier ones. Assignments without content are left
 * out.
 */
export function resolveSequence(
  assignments: readonly StudentAssignment[],
  records: ReadonlyMap<string, SectionRecord>,
  now: number,
): SequenceEntry[] {
  return assignments
    .filter((assignment) => hasActivityContent(assignment.activity.type))
    .sort((a, b) => a.activity.order_index - b.activity.order_index || a.id.localeCompare(b.id))
    .map((assignment) => {
      const record = records.get(assignment.id);
      return {
        assignment,
        schedule: scheduleStatus(assignment, now),
        complete: isSectionComplete(
          assignment.activity.type,
          record?.progress ?? null,
          record?.passedQuizKeys ?? NO_QUIZZES,
        ),
      };
    });
}

/** The next open, unfinished section after the given one. */
export function nextSection(
  entries: readonly SequenceEntry[],
  assignmentId: string,
): SequenceEntry | null {
  const index = entries.findIndex((entry) => entry.assignment.id === assignmentId);
  if (index < 0) return null;
  return entries.slice(index + 1).find(
    (entry) => entry.schedule === "Open" && !entry.complete,
  ) ?? null;
}

export function assignmentPath(assignment: Pick<StudentAssignment, "id">): string {
  return `/student/assignments/${assignment.id}`;
}
