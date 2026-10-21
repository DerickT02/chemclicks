import { describe, expect, it } from "vitest";
import { evaluateAnswer } from "@/lib/measurement/answer";
import { quantizeReading } from "@/lib/measurement/instruments";
import {
  getMeasurementQuizMode,
  measurementAttemptLabel,
  measurementQuizModeForActivity,
  type MeasurementQuizModeKey,
} from "@/lib/measurement/modes";
import {
  MODE_QUESTION_POOL,
  QUESTIONS_PER_ATTEMPT,
  pickReadings,
  quizReducer,
  type QuestionState,
  type QuizAction,
  type QuizState,
} from "@/lib/measurement/quiz";

describe("assigned measurement quiz modes", () => {
  it.each([
    ["measurement_ruler_tenths", "ruler_tenths", 1],
    ["measurement_ruler_hundredths", "ruler_hundredths", 2],
    ["measurement_graduated_cylinder", "cylinder_tenths", 1],
  ] as const)("maps %s to the required precision", (activityType, modeKey, decimals) => {
    const mode = measurementQuizModeForActivity(activityType);
    expect(mode?.key).toBe(modeKey);
    expect(mode?.spec.decimals).toBe(decimals);
    expect(mode?.precision).toBe(decimals === 2 ? "hundredths" : "tenths");
  });

  it("draws five unique questions from the assigned mode pool", () => {
    for (const [key, pool] of Object.entries(MODE_QUESTION_POOL)) {
      const instrument = key.startsWith("cylinder") ? "cylinder" : "ruler";
      const readings = pickReadings(instrument, () => 0, key as keyof typeof MODE_QUESTION_POOL);
      expect(readings).toHaveLength(QUESTIONS_PER_ATTEMPT);
      expect(new Set(readings).size).toBe(QUESTIONS_PER_ATTEMPT);
      expect(readings.every((reading) => pool.includes(reading))).toBe(true);
    }
  });

  it("only asks for readings the instrument can show", () => {
    for (const [key, pool] of Object.entries(MODE_QUESTION_POOL)) {
      const { spec } = getMeasurementQuizMode(key as keyof typeof MODE_QUESTION_POOL);
      for (const reading of pool) {
        expect(reading).toBeGreaterThanOrEqual(spec.min);
        expect(reading).toBeLessThanOrEqual(spec.max);
      }
    }
  });

  it("grades assigned ruler modes at their configured precision", () => {
    const tenths = measurementQuizModeForActivity("measurement_ruler_tenths")!;
    const hundredths = measurementQuizModeForActivity("measurement_ruler_hundredths")!;
    expect(evaluateAnswer("1.4", 1.4, tenths.spec).status).toBe("correct");
    expect(evaluateAnswer("1.40", 1.4, tenths.spec).status).toBe("incorrect");
    expect(evaluateAnswer("1.46", 1.46, hundredths.spec).status).toBe("correct");
    expect(evaluateAnswer("1.4", 1.46, hundredths.spec).status).toBe("incorrect");
  });

  it("reads the tenths ruler against whole-centimeter marks and estimates the tenths digit", () => {
    const { spec } = getMeasurementQuizMode("ruler_tenths");
    expect(spec).toMatchObject({ graduation: 1, step: 0.1, decimals: 1, tolerance: 0.2 });
  });

  it("keeps every pool reading on its mode's step", () => {
    for (const [key, pool] of Object.entries(MODE_QUESTION_POOL)) {
      const { spec } = getMeasurementQuizMode(key as MeasurementQuizModeKey);
      for (const reading of pool) expect(quantizeReading(reading, spec)).toBe(reading);
    }
  });
});

describe("measurement mode tolerance boundaries", () => {
  it.each([
    // mode, reading, just inside (both sides), just outside (both sides), wrong precision
    ["ruler_tenths", 4.3, ["4.5", "4.1"], ["4.6", "4.0"], "4.30"],
    ["ruler_hundredths", 4.37, ["4.39", "4.35"], ["4.40", "4.34"], "4.4"],
    ["cylinder_tenths", 23.4, ["23.6", "23.2"], ["23.7", "23.1"], "23.40"],
  ] as const)("grades %s at its documented tolerance", (key, reading, inside, outside, wrongPrecision) => {
    const { spec } = getMeasurementQuizMode(key);
    for (const answer of inside) expect(evaluateAnswer(answer, reading, spec).status).toBe("correct");
    for (const answer of outside) {
      expect(evaluateAnswer(answer, reading, spec)).toMatchObject({ status: "incorrect", reason: "value" });
    }
    expect(evaluateAnswer(wrongPrecision, reading, spec)).toMatchObject({
      status: "incorrect",
      reason: "precision",
    });
  });

  it.each([
    ["ruler_tenths", "0.0", 0.2, "10.0", 9.8],
    ["ruler_hundredths", "0.00", 0.02, "10.00", 9.98],
    ["cylinder_tenths", "0.0", 0.2, "50.0", 49.8],
  ] as const)("accepts %s answers at the ends of the scale", (key, low, lowReading, high, highReading) => {
    const { spec } = getMeasurementQuizMode(key);
    expect(evaluateAnswer(low, lowReading, spec).status).toBe("correct");
    expect(evaluateAnswer(high, highReading, spec).status).toBe("correct");
  });

  it.each([
    ["ruler_tenths", 4.3, "5.0", "4.3 cm"],
    ["ruler_hundredths", 4.37, "5.00", "4.37 cm"],
    ["cylinder_tenths", 23.4, "30.0", "23.4 mL"],
  ] as const)("names the expected %s reading in incorrect feedback", (key, reading, wrong, expected) => {
    const { spec } = getMeasurementQuizMode(key);
    expect(evaluateAnswer(wrong, reading, spec).message).toContain(expected);
  });
});

describe("first-answer scoring in each mode", () => {
  const run = (state: QuizState, ...actions: QuizAction[]) => actions.reduce(quizReducer, state);
  const asQuestion = (state: QuizState): QuestionState => {
    if (state.phase !== "question") throw new Error("Expected a question");
    return state;
  };

  it.each([
    ["ruler_tenths", "ruler", 4.3, "4.5", "4.6"],
    ["ruler_hundredths", "ruler", 4.37, "4.39", "4.40"],
    ["cylinder_tenths", "cylinder", 23.4, "23.6", "23.7"],
  ] as const)("scores only the first gradable %s answer", (mode, instrument, reading, edge, outside) => {
    const started: QuizState = run({ phase: "choosing", returned: false }, {
      type: "start", instrument, mode, readings: [reading, reading, reading, reading, reading],
    });

    const firstWrong = asQuestion(run(started,
      { type: "edit-answer", answer: "abc" }, { type: "submit" },
      { type: "edit-answer", answer: outside }, { type: "submit" },
      { type: "edit-answer", answer: edge }, { type: "submit" },
    ));
    expect(firstWrong).toMatchObject({ firstTryCorrect: false, score: 0, result: { status: "correct" } });

    const firstRight = asQuestion(run(started, { type: "edit-answer", answer: edge }, { type: "submit" }));
    expect(firstRight).toMatchObject({ firstTryCorrect: true, score: 1 });
  });
});

describe("measurementAttemptLabel", () => {
  it.each([
    ["ruler", "tenths", "Ruler · tenths (0.1 cm)"],
    ["ruler", "hundredths", "Ruler · hundredths (0.01 cm)"],
    ["cylinder", "tenths", "Graduated cylinder · tenths (0.1 mL)"],
  ])("names %s at %s precision", (instrument, precision, label) => {
    expect(measurementAttemptLabel(instrument, precision)).toBe(label);
  });

  it("falls back to the instrument name for an unknown precision", () => {
    expect(measurementAttemptLabel("cylinder", "hundredths")).toBe("Graduated cylinder");
    expect(measurementAttemptLabel("ruler", null)).toBe("Ruler");
  });
});
