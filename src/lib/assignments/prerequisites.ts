import "server-only";

import { getStudentAssignments } from "@/lib/db/student-assignments";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentSession } from "@/lib/auth/student-session";

export type QuizProgression = {
  passed: boolean;
  nextDestination: string | null;
};

/**
 * Resolves the next assignment only after the authenticated student's own
 * persisted quiz attempt has passed. The returned assignment has already
 * passed the same available-assignment check used by the student dashboard.
 */
export async function getQuizProgression(
  assignmentId: string,
  quizKey: string,
): Promise<QuizProgression> {
  const session = await getStudentSession();
  if (!session) return { passed: false, nextDestination: null };

  const assignments = await getStudentAssignments();
  if (assignments.status !== "ok") {
    return { passed: false, nextDestination: null };
  }

  const currentIndex = assignments.assignments.findIndex(
    (assignment) => assignment.id === assignmentId,
  );
  if (currentIndex < 0) return { passed: false, nextDestination: null };

  const current = assignments.assignments[currentIndex];
  const admin = createAdminClient();
  const { data: progress, error: progressError } = await admin
    .from("student_progress")
    .select("id")
    .eq("student_id", session.studentId)
    .eq("class_activity_id", current.id)
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

  const next = assignments.assignments[currentIndex + 1];
  return {
    passed: true,
    nextDestination: next ? `/student/assignments/${next.id}` : null,
  };
}
