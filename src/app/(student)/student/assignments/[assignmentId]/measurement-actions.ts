"use server";

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
  submissionKey: string,
) {
  const attempt = await completeStudentMeasurementQuiz(assignmentId, attemptId, submissionKey);
  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attempt_number,
    score: attempt.score ?? 0,
    total: attempt.question_total ?? 0,
    passed: attempt.passed === true,
    completedAt: attempt.completed_at,
  };
}
