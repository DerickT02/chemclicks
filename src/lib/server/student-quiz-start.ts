import "server-only";

import { getStudentSession } from "@/lib/auth/student-session";
import { createServiceClient } from "@/lib/server/database";

const UUID_PATTERN =
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const QUIZ_KEY_PATTERN = /^[a-z0-9_]+$/;

export type QuizStart = {
  progress_id: string;
  status: "in_progress";
  started_at: string;
};

export async function startStudentQuiz(
  assignmentId: string,
  quizKey: string,
): Promise<QuizStart> {
  const session = await getStudentSession();
  if (!session) throw new Error("A student session is required.");

  if (!UUID_PATTERN.test(assignmentId)
    || !QUIZ_KEY_PATTERN.test(quizKey)) {
    throw new Error("Invalid quiz start.");
  }

  const { data, error } = await createServiceClient().rpc("student_quiz_start", {
    p_student_id: session.studentId,
    p_class_id: session.classId,
    p_assignment_id: assignmentId,
    p_quiz_key: quizKey,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The quiz could not be started. Refresh and try again.");
  }

  return data as QuizStart;
}
