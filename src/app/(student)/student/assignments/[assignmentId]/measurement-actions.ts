"use server";

import { revalidatePath } from "next/cache";
import { getQuizProgression } from "@/lib/assignments/prerequisites";
import {
  completeStudentMeasurementQuiz,
  recordStudentMeasurementAnswer,
  startStudentMeasurementQuiz,
} from "@/lib/server/student-measurement-quizzes";

export async function startMeasurementQuizAction(assignmentId: string, mode: string) {
  return startStudentMeasurementQuiz(assignmentId, mode);
}

export async function recordMeasurementAnswerAction(
  assignmentId: string,
  attemptId: string,
  questionIndex: number,
  answer: string,
) {
  return recordStudentMeasurementAnswer(assignmentId, attemptId, questionIndex, answer);
}

export async function completeMeasurementQuizAction(
  assignmentId: string,
  attemptId: string,
) {
  const attempt = await completeStudentMeasurementQuiz(assignmentId, attemptId);
  revalidatePath(`/student/assignments/${assignmentId}`);
  const progression = attempt.quiz_key
    ? await getQuizProgression(assignmentId, attempt.quiz_key)
    : { passed: false, assignmentCompleted: null, nextDestination: null };
  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attempt_number,
    score: attempt.score ?? 0,
    total: attempt.question_total ?? 0,
    passed: attempt.passed === true,
    assignmentCompleted: progression.assignmentCompleted,
    completedAt: attempt.completed_at,
    nextDestination: attempt.passed === true && progression.passed ? progression.nextDestination : null,
  };
}
