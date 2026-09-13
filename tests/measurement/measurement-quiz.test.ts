import { describe, expect, it } from "vitest";

import {
  INSTRUMENT_IDS,
  INSTRUMENTS,
  quantizeReading,
  type InstrumentId,
} from "../../src/lib/measurement/instruments";
import {
  INITIAL_QUIZ_STATE,
  QUESTION_POOL,
  QUESTIONS_PER_ATTEMPT,
  canContinue,
  currentReading,
  hasPassed,
  passingScore,
  pickReadings,
  quizReducer,
  type QuestionState,
  type QuizAction,
  type QuizState,
} from "../../src/lib/measurement/quiz";

const READINGS: Record<InstrumentId, readonly number[]> = {
  ruler: [4.37, 11.62, 2.85, 7.18, 9.21],
  cylinder: [23.4, 41.7, 8.6, 31.1, 17.2],
};

function start(instrument: InstrumentId): QuizAction {
  return { type: "start", instrument, readings: READINGS[instrument] };
}

function run(state: QuizState, ...actions: QuizAction[]): QuizState {
  return actions.reduce(quizReducer, state);
}

function asQuestion(state: QuizState): QuestionState {
  if (state.phase !== "question") throw new Error("Expected a question to be showing");
  return state;
}

function answer(value: string): QuizAction[] {
  return [{ type: "edit-answer", answer: value }, { type: "submit" }];
}

/** Plays a whole cylinder attempt, answering wrong first on the given questions. */
function playCylinderAttempt(wrongQuestions: number[]): QuizState {
  let state = run(INITIAL_QUIZ_STATE, start("cylinder"));

  READINGS.cylinder.forEach((reading, index) => {
    const value = wrongQuestions.includes(index) ? "0.5" : reading.toFixed(1);
    state = run(state, ...answer(value), { type: "next" });
  });

  return state;
}

describe("question pool", () => {
  it("holds more distinct, reachable, already-quantized readings than one attempt uses", () => {
    for (const id of INSTRUMENT_IDS) {
      const spec = INSTRUMENTS[id];
      const pool = QUESTION_POOL[id];

      expect(pool.length).toBeGreaterThan(QUESTIONS_PER_ATTEMPT);
      expect(new Set(pool).size).toBe(pool.length);

      for (const reading of pool) {
        expect(reading).toBeGreaterThanOrEqual(spec.min);
        expect(reading).toBeLessThanOrEqual(spec.max);
        expect(quantizeReading(reading, spec)).toBe(reading);
      }
    }
  });
});

describe("pickReadings", () => {
  it("draws a full attempt of distinct readings from the instrument's own pool", () => {
    for (const id of INSTRUMENT_IDS) {
      const readings = pickReadings(id);

      expect(readings).toHaveLength(QUESTIONS_PER_ATTEMPT);
      expect(new Set(readings).size).toBe(QUESTIONS_PER_ATTEMPT);
      for (const reading of readings) expect(QUESTION_POOL[id]).toContain(reading);
    }
  });

  it("draws different questions for different random values", () => {
    // A source just under 1 never swaps, so the draw is the start of the pool.
    const unshuffled = pickReadings("ruler", () => 0.9999);
    const shuffled = pickReadings("ruler", () => 0);

    expect(unshuffled).toEqual(QUESTION_POOL.ruler.slice(0, QUESTIONS_PER_ATTEMPT));
    expect(shuffled).not.toEqual(unshuffled);
  });

  it("leaves the pool itself untouched", () => {
    const before = [...QUESTION_POOL.cylinder];

    pickReadings("cylinder", () => 0);

    expect(QUESTION_POOL.cylinder).toEqual(before);
  });
});

describe("pass mark", () => {
  it("passes at exactly 80% and fails just below it", () => {
    expect(passingScore(QUESTIONS_PER_ATTEMPT)).toBe(4);
    expect(hasPassed(5, 5)).toBe(true);
    expect(hasPassed(4, 5)).toBe(true);
    expect(hasPassed(3, 5)).toBe(false);
  });

  it("rounds a fractional threshold up so a pass is always at least 80%", () => {
    expect(passingScore(3)).toBe(3);
    expect(passingScore(10)).toBe(8);
    expect(passingScore(15)).toBe(12);
  });
});

describe("quizReducer", () => {
  it("starts a ruler attempt at its first drawn reading with no answer or score", () => {
    const question = asQuestion(run(INITIAL_QUIZ_STATE, start("ruler")));

    expect(question).toMatchObject({
      instrument: "ruler",
      readings: READINGS.ruler,
      questionIndex: 0,
      answer: "",
      result: null,
      firstTryCorrect: null,
      score: 0,
    });
    expect(currentReading(question)).toBe(READINGS.ruler[0]);
  });

  it("starts a graduated cylinder attempt at its first drawn reading", () => {
    const question = asQuestion(run(INITIAL_QUIZ_STATE, start("cylinder")));

    expect(question.instrument).toBe("cylinder");
    expect(currentReading(question)).toBe(READINGS.cylinder[0]);
  });

  it("ignores question actions while choosing an instrument or showing results", () => {
    const results = playCylinderAttempt([]);

    for (const state of [INITIAL_QUIZ_STATE, results]) {
      for (const action of [
        { type: "submit" },
        { type: "next" },
        { type: "edit-answer", answer: "1.00" },
      ] satisfies QuizAction[]) {
        expect(quizReducer(state, action)).toBe(state);
      }
    }
  });

  it("does not advance on an invalid answer", () => {
    const started = run(INITIAL_QUIZ_STATE, start("ruler"));

    for (const input of ["", "abc", "4.37cm", "99.00"]) {
      const question = asQuestion(run(started, ...answer(input)));

      expect(question.result?.status).toBe("invalid");
      expect(canContinue(question)).toBe(false);
      expect(quizReducer(question, { type: "next" })).toBe(question);
    }
  });

  it("scores a correct first answer and carries the score to the next question", () => {
    const question = asQuestion(run(INITIAL_QUIZ_STATE, start("ruler"), ...answer("4.37")));

    expect(question.result?.status).toBe("correct");
    expect(question).toMatchObject({ firstTryCorrect: true, score: 1 });
    expect(canContinue(question)).toBe(true);

    const next = asQuestion(quizReducer(question, { type: "next" }));
    expect(currentReading(next)).toBe(READINGS.ruler[1]);
    expect(next).toMatchObject({
      questionIndex: 1,
      answer: "",
      result: null,
      attempt: 0,
      firstTryCorrect: null,
      score: 1,
    });
  });

  it("lets the student retry or skip after a wrong answer, without scoring the retry", () => {
    const wrong = asQuestion(run(INITIAL_QUIZ_STATE, start("cylinder"), ...answer("30.0")));

    expect(wrong.result?.status).toBe("incorrect");
    expect(wrong).toMatchObject({ questionIndex: 0, firstTryCorrect: false, score: 0 });
    expect(canContinue(wrong)).toBe(true);

    const retried = asQuestion(run(wrong, ...answer("23.4")));
    expect(retried.result?.status).toBe("correct");
    expect(retried).toMatchObject({ attempt: 2, firstTryCorrect: false, score: 0 });

    const skipped = asQuestion(quizReducer(wrong, { type: "next" }));
    expect(skipped).toMatchObject({ questionIndex: 1, score: 0 });
  });

  it("does not use up the first try on blank or malformed input", () => {
    const question = asQuestion(
      run(INITIAL_QUIZ_STATE, start("ruler"), ...answer(""), ...answer("4.37cm"), ...answer("4.37")),
    );

    expect(question.result?.status).toBe("correct");
    expect(question).toMatchObject({ firstTryCorrect: true, score: 1 });
  });

  it("counts every submission so repeated feedback is announced again", () => {
    const started = run(INITIAL_QUIZ_STATE, start("ruler"));
    const question = asQuestion(run(started, ...answer(""), { type: "submit" }));

    expect(question.attempt).toBe(2);
  });

  it("keeps a correct result, and its score, when submitted again", () => {
    const correct = run(INITIAL_QUIZ_STATE, start("ruler"), ...answer("4.37"));

    expect(quizReducer(correct, { type: "submit" })).toBe(correct);
  });

  it("grades each question against the reading the instrument is locked at", () => {
    const second = run(INITIAL_QUIZ_STATE, start("ruler"), ...answer("4.37"), { type: "next" });

    expect(asQuestion(run(second, ...answer("4.37"))).result?.status).toBe("incorrect");
    expect(asQuestion(run(second, ...answer("11.62"))).result?.status).toBe("correct");
  });

  it("shows results after the last question", () => {
    expect(playCylinderAttempt([])).toEqual({
      phase: "results",
      instrument: "cylinder",
      score: 5,
      total: 5,
    });
  });

  it("passes an attempt with one question wrong and fails one with two wrong", () => {
    const oneWrong = playCylinderAttempt([2]);
    const twoWrong = playCylinderAttempt([0, 4]);

    expect(oneWrong).toMatchObject({ phase: "results", score: 4, total: 5 });
    expect(twoWrong).toMatchObject({ phase: "results", score: 3, total: 5 });
    if (oneWrong.phase !== "results" || twoWrong.phase !== "results") throw new Error();
    expect(hasPassed(oneWrong.score, oneWrong.total)).toBe(true);
    expect(hasPassed(twoWrong.score, twoWrong.total)).toBe(false);
  });

  it("starts a fresh attempt with new readings and a zero score when trying again", () => {
    const readings = [47.9, 6.3, 19.5, 36.6, 12.7];
    const retry = asQuestion(
      quizReducer(playCylinderAttempt([0, 1]), { type: "start", instrument: "cylinder", readings }),
    );

    expect(retry).toMatchObject({ readings, questionIndex: 0, score: 0 });
    expect(currentReading(retry)).toBe(47.9);
  });

  it("returns to the chooser when the student picks a different instrument", () => {
    const started = run(INITIAL_QUIZ_STATE, start("ruler"));

    expect(INITIAL_QUIZ_STATE).toEqual({ phase: "choosing", returned: false });
    expect(quizReducer(started, { type: "choose-instrument" })).toEqual({
      phase: "choosing",
      returned: true,
    });
  });
});
