import "server-only";

import { getStudentAssignmentSchedules, type StudentAssignment } from "@/lib/db/student-assignments";
import { getStudentSession } from "@/lib/auth/student-session";
import { scheduleStatus } from "@/lib/assignments/schedule";
import { readStudentAssignmentProgressStates } from "@/lib/server/student-assignment-progress";
import {
  assignmentPath,
  nextSection,
  resolveSequence,
  sectionQuizKeys,
  type SectionRecord,
  type SequenceEntry,
} from "@/lib/assignments/sequence";

export type QuizProgression = {
  passed: boolean;
  assignmentCompleted: boolean;
  nextDestination: string | null;
};

export type AssignmentSequenceResult =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "ok"; entries: SequenceEntry[] };

export type AssignmentGate =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "scheduled"; entry: SequenceEntry }
  | { status: "closed"; entry: SequenceEntry }
  | { status: "open"; entry: SequenceEntry; next: SequenceEntry | null };

/** Whether a quiz for this lesson assignment can be taken now. */
export type SectionAccess =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "scheduled"; assignment: StudentAssignment }
  | { status: "closed"; assignment: StudentAssignment }
  | { status: "available"; assignment: StudentAssignment };

const LOAD_ERROR = "Your assignments could not be loaded. Please try again.";

/**
 * The signed-in student's own sections in lesson order, each with its
 * completion state. Never accepts student or class IDs from callers.
 */
export async function getAssignmentSequence(): Promise<AssignmentSequenceResult> {
  const session = await getStudentSession();
  if (!session) return { status: "unauthenticated" };
  const schedules = await getStudentAssignmentSchedules();
  if (schedules.status !== "ok") return schedules;

  const records = new Map<string, SectionRecord>();
  const ids = schedules.assignments.map((assignment) => assignment.id);
  if (ids.length > 0) {
    try {
      const states = await readStudentAssignmentProgressStates(session.studentId, session.classId, ids);
      for (const [assignmentId, state] of states) records.set(assignmentId, state);
    } catch {
      return { status: "error", message: LOAD_ERROR };
    }
  }

  return { status: "ok", entries: resolveSequence(schedules.assignments, records, Date.now()) };
}

/** Whether the student may work on this assignment now, and where "next" leads. */
export async function getAssignmentGate(assignmentId: string): Promise<AssignmentGate> {
  const sequence = await getAssignmentSequence();
  if (sequence.status !== "ok") return sequence;
  const entry = sequence.entries.find((candidate) => candidate.assignment.id === assignmentId);
  if (!entry) return { status: "missing" };
  switch (entry.schedule) {
    case "Scheduled":
      return { status: "scheduled", entry };
    case "Closed":
      return { status: "closed", entry };
    case "Open":
      return { status: "open", entry, next: nextSection(sequence.entries, assignmentId) };
    default:
      return { status: "missing" };
  }
}

/** Whether one of the student's own assignments is open now. */
export async function getSectionAccess(assignment: StudentAssignment): Promise<SectionAccess> {
  const status = scheduleStatus(assignment, Date.now());
  if (status === "Scheduled") return { status: "scheduled", assignment };
  if (status !== "Open") return { status: "closed", assignment };
  return { status: "available", assignment };
}

/**
 * Reads the first passing quiz from the shared assignment state. Continuation
 * is available only when the assignment's full shared state is complete.
 */
export async function getQuizProgression(
  assignmentId: string,
  quizKey: string,
): Promise<QuizProgression> {
  const sequence = await getAssignmentSequence();
  if (sequence.status !== "ok") {
    return { passed: false, assignmentCompleted: false, nextDestination: null };
  }
  const entry = sequence.entries.find((candidate) => candidate.assignment.id === assignmentId);
  if (!entry) return { passed: false, assignmentCompleted: false, nextDestination: null };

  const allowedKeys = sectionQuizKeys(entry.assignment.activity.type);
  const passed = allowedKeys.has(quizKey)
    && entry.state?.passingQuizKey !== null
    && entry.state?.passingQuizKey !== undefined
    && allowedKeys.has(entry.state.passingQuizKey);
  const assignmentCompleted = entry.state?.status === "completed";
  const next = entry.schedule === "Open" && passed && assignmentCompleted
    ? nextSection(sequence.entries, assignmentId)
    : null;
  return {
    passed,
    assignmentCompleted,
    nextDestination: next ? assignmentPath(next.assignment) : null,
  };
}
