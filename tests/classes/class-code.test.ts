import { describe, expect, it } from "vitest";
import {
  CLASS_CODE_ALPHABET,
  CLASS_CODE_PATTERN,
  cryptoRandomInt,
  isValidClassCode,
  normalizeClassCode,
  randomClassCode,
} from "@/lib/classes/class-code";

describe("classroom code format", () => {
  it("generates six uppercase letters or digits", () => {
    for (let i = 0; i < 200; i++) {
      const code = randomClassCode();
      expect(code).toMatch(CLASS_CODE_PATTERN);
      expect(isValidClassCode(code)).toBe(true);
    }
  });

  it("draws every character from the accepted alphabet", () => {
    const sequence = [0, 25, 26, 35, 1, 34];
    let i = 0;
    expect(randomClassCode(() => sequence[i++])).toBe("AZ09B8");
    expect(new Set(CLASS_CODE_ALPHABET).size).toBe(36);
  });

  it("returns integers in range", () => {
    for (let i = 0; i < 500; i++) {
      const value = cryptoRandomInt(36);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(36);
    }
  });

  it("normalizes manual entry with the same rules as generated codes", () => {
    expect(normalizeClassCode("  a1b2c3 ")).toBe("A1B2C3");
    expect(isValidClassCode(normalizeClassCode("a1b2c3"))).toBe(true);
    expect(isValidClassCode("A1B2C")).toBe(false);
    expect(isValidClassCode("A1B2C3D")).toBe(false);
    expect(isValidClassCode("A1-2C3")).toBe(false);
  });
});
