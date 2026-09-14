import { evaluateAnswer, type AnswerResult } from "@/lib/measurement/answer";
import { INSTRUMENTS, type InstrumentId } from "@/lib/measurement/instruments";

/**
 * Readings each attempt draws its questions from. Every one is already on the
 * instrument's step, so the cursor is drawn exactly where the answer is graded.
 */
export const QUESTION_POOL: Record<InstrumentId, readonly number[]> = {
  ruler: [1.46, 2.85, 3.72, 4.37, 5.93, 7.18, 8.64, 9.21, 10.55, 11.62, 12.09, 13.78],
  cylinder: [6.3, 8.6, 12.7, 17.2, 19.5, 23.4, 28.8, 31.1, 36.6, 41.7, 44.3, 47.9],
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
): number[] {
  const pool = [...QUESTION_POOL[instrument]];

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
  | { type: "start"; instrument: InstrumentId; readings: readonly number[] }
  | { type: "edit-answer"; answer: string }
  | { type: "submit" }
  | { type: "next" }
  | { type: "choose-instrument" };

export const INITIAL_QUIZ_STATE: QuizState = { phase: "choosing", returned: false };

/** Where the locked instrument sits for this question. Answers are graded against it. */
export function currentReading(question: QuestionState): number {
  return question.readings[question.questionIndex];
}

function startQuestion(
  instrument: InstrumentId,
  readings: readonly number[],
  questionIndex: number,
  score: number,
): QuestionState {
  return {
    phase: "question",
    instrument,
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
  if (action.type === "start") return startQuestion(action.instrument, action.readings, 0, 0);
  if (action.type === "choose-instrument") return { phase: "choosing", returned: true };
  if (state.phase !== "question") return state;

  switch (action.type) {
    case "edit-answer":
      return { ...state, answer: action.answer };

    case "submit": {
      if (state.result?.status === "correct") return state;

      const result = evaluateAnswer(state.answer, currentReading(state), INSTRUMENTS[state.instrument]);
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

    case "next": {
      if (!canContinue(state)) return state;

      const nextIndex = state.questionIndex + 1;
      return nextIndex < state.readings.length
        ? startQuestion(state.instrument, state.readings, nextIndex, state.score)
        : {
            phase: "results",
            instrument: state.instrument,
            score: state.score,
            total: state.readings.length,
          };
    }
  }
}
