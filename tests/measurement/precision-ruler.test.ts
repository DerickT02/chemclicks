import { describe, expect, it } from "vitest";
import { DEFAULT_CM, RULER_MIN_CM, RULER_MAX_CM, STEP_CM, formatCm, quantizeCm } from "@/components/measurement/PrecisionRuler";

describe("single tenths ruler", () => {
  it("uses a 0–10 cm scale and tenths by default", () => {
    expect([RULER_MIN_CM, RULER_MAX_CM, DEFAULT_CM, STEP_CM]).toEqual([0, 10, 5, 0.1]);
    expect(quantizeCm(3.44)).toBe(3.4);
    expect(quantizeCm(3.46)).toBe(3.5);
  });
  it("clamps and formats exactly one decimal place", () => {
    expect(formatCm(-5)).toBe("0.0");
    expect(formatCm(3.44)).toBe("3.4");
    expect(formatCm(9.99)).toBe("10.0");
    expect(formatCm(20)).toBe("10.0");
  });
  it("keeps quantized values stable", () => {
    for (const sample of [-1, 0, 0.15, 3.46, 9.95, 10, 11]) {
      const quantized = quantizeCm(sample);
      expect(quantizeCm(quantized)).toBe(quantized);
      expect(formatCm(sample)).toBe(quantized.toFixed(1));
    }
  });
});
