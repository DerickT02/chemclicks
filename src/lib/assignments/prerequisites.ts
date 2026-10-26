import "server-only";

import { getStudentAssignmentSchedules, type StudentAssignment } from "@/lib/db/student-assignments";
import type { ProgressStatus } from "@/lib/db/student_progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentSession } from "@/lib/auth/student-session";
import { scheduleStatus } from "@/lib/assignments/schedule";
import {
  assignmentPath,
  nextSection,
  resolveSequence,
  type SectionRecord,
  type SequenceEntry,
} from "@/lib/assignments/sequence";

export type QuizProgression = {
  passed: boolean;
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
  | { status: "locked"; entry: SequenceEntry; blocker: StudentAssignment }
  | { status: "open"; entry: SequenceEntry; next: SequenceEntry | null };

/** Whether a quiz for this lesson assignment can be taken now. */
export type SectionAccess =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "scheduled"; assignment: StudentAssignment }
  | { status: "closed"; assignment: StudentAssignment }
  | { status: "blocked"; assignment: StudentAssignment; blocker: StudentAssignment }
  | { status: "available"; assignment: StudentAssignment };

export const LOCKED_MESSAGE = "Finish the earlier sections first.";
const LOAD_ERROR = "Your assignments could not be loaded. Please try again.";

type ProgressRow = { id: string; class_activity_id: string; status: ProgressStatus };
type PassedAttemptRow = { progress_id: string; quiz_key: string };

/**
 * The signed-in student's own sections in lesson order, each with its
 * completion and lock state. Never accepts student or class IDs from callers.
 */
export async function getAssignmentSequence(): Promise<AssignmentSequenceResult> {
  const session = await getStudentSession();
  if (!session) return { status: "unauthenticated" };
  const schedules = await getStudentAssignmentSchedules();
  if (schedules.status !== "ok") return schedules;

  const records = new Map<string, SectionRecord>();
  const ids = schedules.assignments.map((assignment) => assignment.id);
  if (ids.length > 0) {
    const admin = createAdminClient();
    const { data: progress, error: progressError } = await admin
      .from("student_progress")
      .select("id, class_activity_id, status")
      .eq("student_id", session.studentId)
      .in("class_activity_id", ids)
      .returns<ProgressRow[]>();
    if (progressError || !progress) return { status: "error", message: LOAD_ERROR };

    const passed = new Map<string, Set<string>>();
    if (progress.length > 0) {
      const { data: attempts, error: attemptError } = await admin
        .from("student_attempts")
        .select("progress_id, quiz_key")
        .in("progress_id", progress.map((row) => row.id))
        .eq("passed", true)
        .eq("status", "completed")
        .not("quiz_key", "is", null)
        .returns<PassedAttemptRow[]>();
      if (attemptError || !attempts) return { status: "error", message: LOAD_ERROR };
      for (const attempt of attempts) {
        const keys = passed.get(attempt.progress_id) ?? new Set<string>();
        keys.add(attempt.quiz_key);
        passed.set(attempt.progress_id, keys);
      }
    }
    for (const row of progress) {
      records.set(row.class_activity_id, {
        progress: row.status,
        passedQuizKeys: passed.get(row.id) ?? new Set(),
      });
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
      return entry.lockedBy
        ? { status: "locked", entry, blocker: entry.lockedBy }
        : { status: "open", entry, next: nextSection(sequence.entries, assignmentId) };
    default:
      return { status: "missing" };
  }
}

/** Schedule first, then prerequisites, for one of the student's own assignments. */
export async function getSectionAccess(assignment: StudentAssignment): Promise<SectionAccess> {
  const status = scheduleStatus(assignment, Date.now());
  if (status === "Scheduled") return { status: "scheduled", assignment };
  if (status !== "Open") return { status: "closed", assignment };
  const gate = await getAssignmentGate(assignment.id);
  if (gate.status === "unauthenticated" || gate.status === "error") return gate;
  if (gate.status === "locked") return { status: "blocked", assignment, blocker: gate.blocker };
  return { status: "available", assignment };
}

/**
 * Server-side prerequisite check for actions that begin new work. Missing,
 * scheduled, and closed assignments are left to the existing access checks.
 */
export async function assertAssignmentUnlocked(assignmentId: string): Promise<void> {
  const gate = await getAssignmentGate(assignmentId);
  if (gate.status === "locked") throw new Error(LOCKED_MESSAGE);
  if (gate.status === "error") throw new Error(gate.message);
}

/**
 * Resolves the next section only after the authenticated student's own
 * persisted quiz attempt has passed. The destination is open and unlocked.
 */
export async function getQuizProgression(
  assignmentId: string,
  quizKey: string,
): Promise<QuizProgression> {
  const session = await getStudentSession();
  if (!session) return { passed: false, nextDestination: null };

  const admin = createAdminClient();
  const { data: progress, error: progressError } = await admin
    .from("student_progress")
    .select("id")
    .eq("student_id", session.studentId)
    .eq("class_activity_id", assignmentId)
    .maybeSingle();
  if (progressError || !progress) {
    return { passed: false, nextDestination: null };
  }

  const { data: passingAttempt, error: attemptError } = await admin
    .from("student_attempts")
    .select("id")
    .eq("progress_id", progress.id)
    .eq("quiz_key", quizKey)
    .eq("passed", true)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
  if (attemptError || !passingAttempt) {
    return { passed: false, nextDestination: null };
  }

  const gate = await getAssignmentGate(assignmentId);
  if (gate.status !== "open") return { passed: false, nextDestination: null };
  return {
    passed: true,
    nextDestination: gate.next ? assignmentPath(gate.next.assignment) : null,
  };
}
