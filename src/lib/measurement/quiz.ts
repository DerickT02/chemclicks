import { evaluateAnswer, type AnswerResult } from "@/lib/measurement/answer";
import { INSTRUMENTS, type InstrumentId } from "@/lib/measurement/instruments";
import { getMeasurementQuizMode, type MeasurementQuizModeKey } from "@/lib/measurement/modes";

/**
 * Readings each attempt draws its questions from. Every one is already on the
 * instrument's step, so the cursor is drawn exactly where the answer is graded.
 */
export const QUESTION_POOL: Record<InstrumentId, readonly number[]> = {
  ruler: [1.46, 2.85, 3.72, 4.37, 5.93, 7.18, 8.64, 9.21, 10.55, 11.62, 12.09, 13.78],
  cylinder: [6.3, 8.6, 12.7, 17.2, 19.5, 23.4, 28.8, 31.1, 36.6, 41.7, 44.3, 47.9],
};

export const MODE_QUESTION_POOL: Record<MeasurementQuizModeKey, readonly number[]> = {
  ruler_tenths: [1.4, 2.8, 3.7, 4.3, 5.9, 7.1, 8.6, 9.2, 10.5, 11.6, 12.0, 13.7],
  ruler_hundredths: QUESTION_POOL.ruler,
  cylinder_tenths: QUESTION_POOL.cylinder,
};

export const QUESTIONS_PER_ATTEMPT = 5;

/** The client's pass mark: at least this share of an attempt's questions right on the first try. */
export const PASS_PERCENT = 80;

/** Fewest first-try correct answers that pass. Integer math, so float error can't move the threshold. */
export function passingScore(total: number): number {
  return Math.ceil((total * PASS_PERCENT) / 100);
}

export function hasPassed(score: number, total: number): boolean {
  return score >= passingScore(total);
}

/**
 * Draws one attempt's readings at random, without repeats. The random source
 * is a parameter so tests can make the draw predictable.
 */
export function pickReadings(
  instrument: InstrumentId,
  random: () => number = Math.random,
  mode: MeasurementQuizModeKey | null = null,
): number[] {
  const pool = mode ? [...MODE_QUESTION_POOL[mode]] : [...QUESTION_POOL[instrument]];

  // Fisher–Yates shuffle: every order is equally likely.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, QUESTIONS_PER_ATTEMPT);
}

export type QuestionState = {
  phase: "question";
  instrument: InstrumentId;
  mode?: MeasurementQuizModeKey | null;
  attemptId?: string;
  attemptNumber?: number;
  /** This attempt's readings, one per question. */
  readings: readonly number[];
  questionIndex: number;
  answer: string;
  result: AnswerResult | null;
  /** Counts submissions so repeated identical feedback is still announced. */
  attempt: number;
  /** Whether the first gradable answer was right, or null before one is submitted. Only it is scored. */
  firstTryCorrect: boolean | null;
  /** First-try correct answers so far this attempt. */
  score: number;
};

export type ResultsState = {
  phase: "results";
  instrument: InstrumentId;
  mode?: MeasurementQuizModeKey | null;
  attemptId?: string;
  attemptNumber?: number;
  passed?: boolean;
  score: number;
  total: number;
};

export type QuizState =
  | {
      phase: "choosing";
      /** True when the student came here from a question, whose focused control is now gone. */
      returned: boolean;
    }
  | QuestionState
  | ResultsState;

export type QuizAction =
  /** Readings come from pickReadings in the caller, so the reducer stays pure. */
  | {
      type: "start";
      instrument: InstrumentId;
      mode?: MeasurementQuizModeKey | null;
      readings: readonly number[];
      attemptId?: string;
      attemptNumber?: number;
      score?: number;
    }
  | { type: "edit-answer"; answer: string }
  | { type: "submit" }
  | { type: "server-submit"; result: AnswerResult; counted: boolean; firstTryCorrect: boolean | null }
  | { type: "server-complete"; attemptId: string; attemptNumber: number; score: number; total: number; passed: boolean }
  | { type: "next" }
  | { type: "choose-instrument" };

export const INITIAL_QUIZ_STATE: QuizState = { phase: "choosing", returned: false };

/** Where the locked instrument sits for this question. Answers are graded against it. */
export function currentReading(question: QuestionState): number {
  return question.readings[question.questionIndex];
}

function startQuestion(
  instrument: InstrumentId,
  mode: MeasurementQuizModeKey | null,
  readings: readonly number[],
  questionIndex: number,
  score: number,
  attemptId?: string,
  attemptNumber?: number,
): QuestionState {
  return {
    phase: "question",
    instrument,
    mode,
    attemptId,
    attemptNumber,
    readings,
    questionIndex,
    answer: "",
    result: null,
    attempt: 0,
    firstTryCorrect: null,
    score,
  };
}

/** A student may move on once they have submitted a gradable answer. */
export function canContinue(question: QuestionState): boolean {
  return question.result !== null && question.result.status !== "invalid";
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  if (action.type === "start") return startQuestion(
    action.instrument,
    action.mode ?? null,
    action.readings,
    0,
    action.score ?? 0,
    action.attemptId,
    action.attemptNumber,
  );
  if (action.type === "server-complete") {
    return {
      phase: "results",
      instrument: state.phase === "question" ? state.instrument : "ruler",
      mode: state.phase === "question" ? state.mode : null,
      attemptId: action.attemptId,
      attemptNumber: action.attemptNumber,
      passed: action.passed,
      score: action.score,
      total: action.total,
    };
  }
  if (action.type === "choose-instrument") return { phase: "choosing", returned: true };
  if (state.phase !== "question") return state;

  switch (action.type) {
    case "edit-answer":
      return { ...state, answer: action.answer };

    case "submit": {
      if (state.result?.status === "correct") return state;

      const spec = state.mode
        ? getMeasurementQuizMode(state.mode).spec
        : INSTRUMENTS[state.instrument];
      const result = evaluateAnswer(state.answer, currentReading(state), spec);
      const submitted = { ...state, result, attempt: state.attempt + 1 };

      // Only the first gradable answer is scored. Blank or malformed input
      // isn't graded, so it doesn't use up the student's try.
      if (state.firstTryCorrect !== null || result.status === "invalid") return submitted;

      const isCorrect = result.status === "correct";
      return {
        ...submitted,
        firstTryCorrect: isCorrect,
        score: isCorrect ? state.score + 1 : state.score,
      };
    }

    case "server-submit": {
      const addsPoint = action.counted && action.firstTryCorrect === true;
      return {
        ...state,
        result: action.result,
        attempt: state.attempt + 1,
        firstTryCorrect: action.firstTryCorrect ?? state.firstTryCorrect,
        score: state.score + (addsPoint ? 1 : 0),
      };
    }

    case "next": {
      if (!canContinue(state)) return state;

      const nextIndex = state.questionIndex + 1;
      return nextIndex < state.readings.length
        ? startQuestion(
            state.instrument,
            state.mode ?? null,
            state.readings,
            nextIndex,
            state.score,
            state.attemptId,
            state.attemptNumber,
          )
        : {
            phase: "results",
            instrument: state.instrument,
            mode: state.mode,
            attemptId: state.attemptId,
            attemptNumber: state.attemptNumber,
            score: state.score,
            total: state.readings.length,
          };
    }
  }
}
