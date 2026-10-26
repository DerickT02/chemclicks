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
} | {
  status: "retry_required";
};

export async function startStudentQuiz(
  assignmentId: string,
  quizKey: string,
  retry = false,
): Promise<QuizStart> {
  const session = await getStudentSession();
  if (!session) throw new Error("A student session is required.");

  if (!UUID_PATTERN.test(assignmentId)
    || !QUIZ_KEY_PATTERN.test(quizKey)) {
    throw new Error("Invalid quiz start.");
  }

  const { data, error } = await createServiceClient().rpc(
    retry === true ? "student_quiz_retry_start" : "student_quiz_start",
    {
      p_student_id: session.studentId,
      p_class_id: session.classId,
      p_assignment_id: assignmentId,
      p_quiz_key: quizKey,
    },
  );

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The quiz could not be started. Refresh and try again.");
  }

  if (data.status === "retry_required") return { status: "retry_required" };
  if (data.status === "in_progress"
    && typeof data.progress_id === "string"
    && UUID_PATTERN.test(data.progress_id)
    && typeof data.started_at === "string"
    && Number.isFinite(Date.parse(data.started_at))) {
    return {
      progress_id: data.progress_id,
      status: "in_progress",
      started_at: data.started_at,
    };
  }

  throw new Error("The quiz could not be started. Refresh and try again.");
}
