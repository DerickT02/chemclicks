import { describe, expect, it } from "vitest";

import {
  DEFAULT_CM,
  RULER_MAX_CM,
  RULER_MIN_CM,
  STEP_CM,
  formatCm,
  quantizeCm,
} from "../../src/components/measurement/PrecisionRuler";

describe("precision ruler measurement helpers", () => {
  it("starts at a reading inside the ruler's range", () => {
    expect(DEFAULT_CM).toBeGreaterThanOrEqual(RULER_MIN_CM);
    expect(DEFAULT_CM).toBeLessThanOrEqual(RULER_MAX_CM);
  });

  it("rounds to the nearest hundredth of a centimeter", () => {
    expect(STEP_CM).toBe(0.01);
    expect(quantizeCm(3.456)).toBe(3.46);
    expect(quantizeCm(3.454)).toBe(3.45);
    expect(quantizeCm(9.999)).toBe(10);
  });

  it("clamps readings to the ends of the ruler", () => {
    expect(quantizeCm(-5)).toBe(RULER_MIN_CM);
    expect(quantizeCm(RULER_MAX_CM + 5)).toBe(RULER_MAX_CM);
  });

  it("formats every reading to exactly two decimal places", () => {
    expect(formatCm(0)).toBe("0.00");
    expect(formatCm(3.4)).toBe("3.40");
    expect(formatCm(3.456)).toBe("3.46");
    expect(formatCm(RULER_MAX_CM)).toBe("15.00");
  });

  it("keeps the cursor position and the readout in sync", () => {
    // The cursor is drawn from the quantized value and the badge from the
    // formatted one, so re-quantizing has to be a no-op or the two can drift.
    for (const sample of [-1, 0, 0.004, 2.225, 7.5, 14.999, 20]) {
      const quantized = quantizeCm(sample);

      expect(formatCm(sample)).toBe(quantized.toFixed(2));
      expect(quantizeCm(quantized)).toBe(quantized);
    }
  });
});
