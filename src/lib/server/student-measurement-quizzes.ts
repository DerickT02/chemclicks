import "server-only";

import { getStudentSession } from "@/lib/auth/student-session";
import { createServiceClient } from "@/lib/server/database";
import type { StudentAttempt } from "@/lib/db/student_attempts";
import type { MeasurementQuizModeKey } from "@/lib/measurement/modes";
import { getMeasurementQuizMode } from "@/lib/measurement/modes";
import { evaluateAnswer, type AnswerResult } from "@/lib/measurement/answer";
import { savedAnswerResult } from "@/lib/measurement/quiz";

const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const MODE_KEYS = new Set<MeasurementQuizModeKey>([
  "ruler_tenths",
  "ruler_hundredths",
  "cylinder_whole",
  "cylinder_tenths",
]);

export type MeasurementAttemptQuestion = {
  questionIndex: number;
  reading: number;
  /** The saved first gradable answer, when an unfinished attempt is resumed. */
  firstAnswer: string | null;
  isCorrect: boolean | null;
};

export type MeasurementAttemptStart = {
  attemptId: string;
  attemptNumber: number;
  questions: MeasurementAttemptQuestion[];
};

export type MeasurementAnswerReceipt = {
  counted: boolean;
  firstTryCorrect: boolean | null;
  result: AnswerResult;
};

function isModeKey(value: string): value is MeasurementQuizModeKey {
  return MODE_KEYS.has(value as MeasurementQuizModeKey);
}

export async function startStudentMeasurementQuiz(
  assignmentId: string,
  mode: string,
): Promise<MeasurementAttemptStart> {
  const session = await getStudentSession();
  if (!session) throw new Error("A student session is required.");
  if (!UUID_PATTERN.test(assignmentId) || !isModeKey(mode)) {
    throw new Error("Invalid measurement quiz request.");
  }

  const { data, error } = await createServiceClient().rpc(
    "student_measurement_quiz_start",
    {
      p_student_id: session.studentId,
      p_class_id: session.classId,
      p_assignment_id: assignmentId,
      p_mode: mode,
    },
  );
  if (error || !data || typeof data !== "object") {
    throw new Error("The measurement quiz could not be started.");
  }

  const response = data as {
    attempt_id?: unknown;
    attempt_number?: unknown;
    mode?: unknown;
    questions?: unknown;
  };
  if (typeof response.attempt_id !== "string"
    || !Number.isInteger(response.attempt_number)
    || (response.attempt_number as number) < 1
    || response.mode !== mode
    || !Array.isArray(response.questions)
    || response.questions.length === 0) {
    throw new Error("The measurement quiz returned an invalid attempt.");
  }

  const questions = response.questions.map((question, index) => {
    if (!question || typeof question !== "object") {
      throw new Error("The measurement quiz returned an invalid question.");
    }
    const row = question as {
      question_index?: unknown;
      reading?: unknown;
      first_answer?: unknown;
      is_correct?: unknown;
    };
    const firstAnswer = row.first_answer ?? null;
    const isCorrect = row.is_correct ?? null;
    if (row.question_index !== index
      || typeof row.reading !== "number"
      || !Number.isFinite(row.reading)
      || !(firstAnswer === null || typeof firstAnswer === "string")
      || !(isCorrect === null || typeof isCorrect === "boolean")
      || (firstAnswer === null) !== (isCorrect === null)) {
      throw new Error("The measurement quiz returned an invalid question.");
    }
    return { questionIndex: index, reading: row.reading, firstAnswer, isCorrect };
  });

  return {
    attemptId: response.attempt_id,
    attemptNumber: response.attempt_number as number,
    questions,
  };
}

export async function recordStudentMeasurementAnswer(
  assignmentId: string,
  attemptId: string,
  questionIndex: number,
  answer: string,
): Promise<MeasurementAnswerReceipt> {
  const session = await getStudentSession();
  if (!session) throw new Error("A student session is required.");
  if (!UUID_PATTERN.test(assignmentId) || !UUID_PATTERN.test(attemptId)
    || !Number.isInteger(questionIndex) || questionIndex < 0
    || typeof answer !== "string" || answer.length > 64) {
    throw new Error("Invalid measurement quiz answer.");
  }

  const { data, error } = await createServiceClient().rpc(
    "student_measurement_quiz_record_answer",
    {
      p_student_id: session.studentId,
      p_class_id: session.classId,
      p_assignment_id: assignmentId,
      p_attempt_id: attemptId,
      p_question_index: questionIndex,
      p_answer: answer,
    },
  );
  if (error || !data || typeof data !== "object") {
    throw new Error("Your answer could not be saved. Please try again.");
  }

  const receipt = data as {
    counted?: unknown;
    first_try_correct?: unknown;
    mode?: unknown;
    reading?: unknown;
  };
  if (typeof receipt.counted !== "boolean"
    || !(typeof receipt.first_try_correct === "boolean" || receipt.first_try_correct === null)
    || (receipt.counted && receipt.first_try_correct === null)
    || typeof receipt.mode !== "string" || !isModeKey(receipt.mode)
    || typeof receipt.reading !== "number" || !Number.isFinite(receipt.reading)) {
    throw new Error("Your answer could not be saved. Please try again.");
  }

  // An answer was already saved for this question, for example by a request
  // whose response was lost. The saved grade stands, not this resubmission.
  if (!receipt.counted && receipt.first_try_correct !== null) {
    return {
      counted: false,
      firstTryCorrect: receipt.first_try_correct,
      result: savedAnswerResult(receipt.first_try_correct),
    };
  }
  return {
    counted: receipt.counted,
    firstTryCorrect: receipt.first_try_correct,
    result: evaluateAnswer(answer, receipt.reading, getMeasurementQuizMode(receipt.mode).spec),
  };
}

export async function completeStudentMeasurementQuiz(
  assignmentId: string,
  attemptId: string,
): Promise<StudentAttempt> {
  const session = await getStudentSession();
  if (!session) throw new Error("A student session is required.");
  if (!UUID_PATTERN.test(assignmentId) || !UUID_PATTERN.test(attemptId)
  ) {
    throw new Error("Invalid measurement quiz completion.");
  }

  const { data, error } = await createServiceClient().rpc(
    "student_measurement_quiz_complete",
    {
      p_student_id: session.studentId,
      p_class_id: session.classId,
      p_assignment_id: assignmentId,
      p_attempt_id: attemptId,
    },
  );
  if (error || !Array.isArray(data) || data.length !== 1 || !isCompletedAttempt(data[0])) {
    throw new Error("The measurement quiz could not be completed.");
  }
  return data[0];
}

function isCompletedAttempt(value: unknown): value is StudentAttempt {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && Number.isInteger(row.attempt_number)
    && Number.isInteger(row.question_total)
    && Number.isInteger(row.score)
    && (row.question_total as number) > 0
    && (row.score as number) >= 0
    && (row.score as number) <= (row.question_total as number)
    && typeof row.passed === "boolean"
    && row.status === "completed";
}
