import { describe, expect, it } from "vitest";
import { evaluateAnswer } from "@/lib/measurement/answer";
import { measurementQuizModeForActivity } from "@/lib/measurement/modes";
import { MODE_QUESTION_POOL, QUESTIONS_PER_ATTEMPT, pickReadings } from "@/lib/measurement/quiz";

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

  it("grades assigned ruler modes at their configured precision", () => {
    const tenths = measurementQuizModeForActivity("measurement_ruler_tenths")!;
    const hundredths = measurementQuizModeForActivity("measurement_ruler_hundredths")!;
    expect(evaluateAnswer("1.4", 1.4, tenths.spec).status).toBe("correct");
    expect(evaluateAnswer("1.40", 1.4, tenths.spec).status).toBe("incorrect");
    expect(evaluateAnswer("1.46", 1.46, hundredths.spec).status).toBe("correct");
    expect(evaluateAnswer("1.4", 1.46, hundredths.spec).status).toBe("incorrect");
  });
});
