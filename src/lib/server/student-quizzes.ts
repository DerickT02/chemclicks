import "server-only";

import { getStudentSession } from "@/lib/auth/student-session";
import { createServiceClient } from "@/lib/server/database";
import type { StudentAttempt } from "@/lib/db/student_attempts";

const UUID_PATTERN =
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const QUIZ_KEY_PATTERN = /^[a-z0-9_]+$/;

export type QuizSubmissionAnswer = {
  questionId: string;
  selectedIndex: number;
};

export type QuizSubmission = {
  assignmentId: string;
  quizKey: string;
  submissionKey: string;
  answers: QuizSubmissionAnswer[];
};

function isValidAnswer(value: QuizSubmissionAnswer): boolean {
  return typeof value.questionId === "string"
    && value.questionId.trim().length > 0
    && Number.isInteger(value.selectedIndex)
    && value.selectedIndex >= 0;
}

/**
 * Submits answers for the authenticated student's own assigned quiz.
 * Scores, totals, percentages, pass state, timestamps, and attempt numbers
 * are all produced by the server/database and are never accepted as input.
 */
export async function submitStudentQuiz(
  submission: QuizSubmission,
): Promise<StudentAttempt> {
  const session = await getStudentSession();
  if (!session) throw new Error("A student session is required.");

  if (typeof submission.assignmentId !== "string"
    || typeof submission.quizKey !== "string"
    || typeof submission.submissionKey !== "string"
    || !Array.isArray(submission.answers)
    || !UUID_PATTERN.test(submission.assignmentId)
    || !QUIZ_KEY_PATTERN.test(submission.quizKey)
    || submission.submissionKey.trim().length === 0
    || submission.answers.length === 0
    || !submission.answers.every(isValidAnswer)) {
    throw new Error("Invalid quiz submission.");
  }

  const { data, error } = await createServiceClient().rpc(
    "student_quiz_submit",
    {
      p_student_id: session.studentId,
      p_class_id: session.classId,
      p_assignment_id: submission.assignmentId,
      p_quiz_key: submission.quizKey,
      p_submission_key: submission.submissionKey,
      p_answers: submission.answers,
    },
  );

  if (error || !data || data.length !== 1) {
    throw new Error(
      "The quiz could not be submitted. Refresh and try again.",
    );
  }

  return data[0] as StudentAttempt;
}
