"use server";

import { submitStudentQuiz } from "@/lib/server/student-quizzes";
import type { QuizAnswer, QuizCompleteResult } from "@/components/quiz/types";

type SubmitQuizInput = {
  assignmentId: string;
  quizKey: string;
  submissionKey: string;
  answers: QuizAnswer[];
};

export async function submitQuizAction(
  input: SubmitQuizInput,
): Promise<QuizCompleteResult> {
  const attempt = await submitStudentQuiz(input);

  return {
    score: attempt.score ?? 0,
    total: attempt.question_total ?? 0,
    percent: attempt.percentage ?? 0,
    passed: attempt.passed === true,
    attemptId: attempt.id,
    attemptNumber: attempt.attempt_number,
  };
}
