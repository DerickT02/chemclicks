"use server";

import { submitStudentQuiz } from "@/lib/server/student-quizzes";
import { getQuizProgression } from "@/lib/assignments/prerequisites";
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
  const progression = attempt.passed
    ? await getQuizProgression(input.assignmentId, input.quizKey)
    : { passed: false, nextDestination: null };

  return {
    score: attempt.score ?? 0,
    total: attempt.question_total ?? 0,
    percent: attempt.percentage ?? 0,
    passed: attempt.passed === true,
    attemptId: attempt.id,
    attemptNumber: attempt.attempt_number,
    nextDestination: progression.passed ? progression.nextDestination : null,
  };
}
