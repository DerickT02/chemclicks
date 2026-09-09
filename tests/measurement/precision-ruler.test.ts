import { describe, expect, it } from "vitest";

import {
  DEFAULT_CM,
  RULER_MAX_CM,
  RULER_MIN_CM,
  STEP_CM,
  clampCm,
  formatCm,
  quantizeCm,
} from "../../src/components/measurement/PrecisionRuler";

describe("precision ruler measurement helpers", () => {
  it("keeps the default reading within range", () => {
    expect(DEFAULT_CM).toBeGreaterThanOrEqual(RULER_MIN_CM);
    expect(DEFAULT_CM).toBeLessThanOrEqual(RULER_MAX_CM);
  });

  it("quantizes representative values to the hundredth place", () => {
    expect(quantizeCm(3.456)).toBe(3.46);
    expect(quantizeCm(3.454)).toBe(3.45);
    expect(quantizeCm(0.001)).toBe(0);
    expect(quantizeCm(9.999)).toBe(10);
  });

  it("rounds to the nearest hundredth using the smallest supported step", () => {
    expect(STEP_CM).toBe(0.01);
    expect(quantizeCm(1.006)).toBe(1.01);
  });

  it("clamps values below the minimum to the minimum", () => {
    expect(clampCm(-5)).toBe(RULER_MIN_CM);
    expect(quantizeCm(-5)).toBe(RULER_MIN_CM);
  });

  it("clamps values above the maximum to the maximum", () => {
    expect(clampCm(RULER_MAX_CM + 5)).toBe(RULER_MAX_CM);
    expect(quantizeCm(RULER_MAX_CM + 5)).toBe(RULER_MAX_CM);
  });

  it("leaves in-range values untouched by clamping", () => {
    expect(clampCm(7.5)).toBe(7.5);
  });

  it("formats every reading to exactly two decimal places", () => {
    expect(formatCm(0)).toBe("0.00");
    expect(formatCm(RULER_MAX_CM)).toBe("15.00");
    expect(formatCm(3.4)).toBe("3.40");
    expect(formatCm(3.456)).toBe("3.46");
  });

  it("keeps the cursor position and readout in sync for any input", () => {
    const samples = [-1, 0, 0.004, 2.225, 7.5, 14.999, 20];

    for (const sample of samples) {
      const quantized = quantizeCm(sample);
      const formatted = formatCm(sample);

      expect(formatted).toBe(quantized.toFixed(2));
      expect(quantized).toBeGreaterThanOrEqual(RULER_MIN_CM);
      expect(quantized).toBeLessThanOrEqual(RULER_MAX_CM);
      // Re-quantizing an already-quantized value must be a no-op, so the
      // displayed cursor and readout can never drift apart.
      expect(quantizeCm(quantized)).toBe(quantized);
    }
  });
});
