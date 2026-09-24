import { describe, expect, it } from "vitest";

import { calculateIonicCharge, describeIonicCharge, evaluateNobleGasRule } from "@/lib/chemistry/bohr-explorer";

describe("ionic charge", () => {
  it("uses protons minus electrons and formats each sign and zero", () => {
    expect(calculateIonicCharge(11, 11)).toBe(0);
    expect(describeIonicCharge(calculateIonicCharge(11, 11)!)).toBe("0 (neutral)");
    expect(calculateIonicCharge(20, 18)).toBe(2);
    expect(describeIonicCharge(calculateIonicCharge(20, 18)!)).toBe("+2 (cation)");
    expect(calculateIonicCharge(8, 10)).toBe(-2);
    expect(describeIonicCharge(calculateIonicCharge(8, 10)!)).toBe("−2 (anion)");
  });

  it("rejects invalid or out-of-range counts", () => {
    for (const [protons, electrons] of [[0, 1], [-1, 1], [21, 20], [1, -1], [1, 21], [1.5, 1], [1, NaN]]) {
      expect(calculateIonicCharge(protons, electrons)).toBeNull();
    }
  });
});

describe("noble-gas shell rule", () => {
  it("requires a duet for the first shell and an octet for later occupied shells", () => {
    expect(evaluateNobleGasRule(0)?.meetsRule).toBe(false);
    expect(evaluateNobleGasRule(1)).toMatchObject({ meetsRule: false, rule: "duet" });
    expect(evaluateNobleGasRule(2)).toMatchObject({ meetsRule: true, rule: "duet" });
    expect(evaluateNobleGasRule(6)).toMatchObject({ meetsRule: false, rule: "octet" });
    expect(evaluateNobleGasRule(10)).toMatchObject({ meetsRule: true, rule: "octet" });
    expect(evaluateNobleGasRule(11)).toMatchObject({ meetsRule: false, rule: "octet" });
    expect(evaluateNobleGasRule(18)).toMatchObject({ meetsRule: true, rule: "octet" });
    expect(evaluateNobleGasRule(19)).toMatchObject({ meetsRule: false, rule: "octet" });
    expect(evaluateNobleGasRule(20)).toMatchObject({ meetsRule: false, rule: "octet" });
  });

  it("only identifies helium, neon, and argon configurations among neutral elements 1–20", () => {
    for (let atomicNumber = 1; atomicNumber <= 20; atomicNumber++) {
      expect(evaluateNobleGasRule(atomicNumber)?.meetsRule).toBe([2, 10, 18].includes(atomicNumber));
    }
  });

  it("does not treat invalid counts as filled shells", () => {
    for (const count of [-1, 21, 8.5, Infinity, NaN]) {
      expect(evaluateNobleGasRule(count)).toBeNull();
    }
  });
});
