import { describe, expect, it } from "vitest";

import { evaluateAnswer } from "../../src/lib/measurement/answer";
import { CYLINDER_SPEC, RULER_SPEC } from "../../src/lib/measurement/instruments";

describe("evaluateAnswer with the ruler", () => {
  const reading = 4.37;
  const grade = (answer: string) => evaluateAnswer(answer, reading, RULER_SPEC);

  it("marks the exact reading correct and states it", () => {
    const result = grade("4.37");

    expect(result.status).toBe("correct");
    expect(result.message).toContain("4.37 cm");
  });

  it("accepts answers up to 0.02 cm away on either side", () => {
    expect(grade("4.39").status).toBe("correct");
    expect(grade("4.35").status).toBe("correct");
    expect(grade("4.39").message).toContain("±0.02 cm");
  });

  it("rejects answers just past the tolerance on either side", () => {
    expect(grade("4.40")).toMatchObject({ status: "incorrect", reason: "value" });
    expect(grade("4.34")).toMatchObject({ status: "incorrect", reason: "value" });
  });

  it("does not reveal the reading in incorrect feedback", () => {
    expect(grade("4.50").message).not.toContain("4.37");
  });

  it("requires the answer to two decimal places", () => {
    for (const answer of ["4.4", "4", "4.370"]) {
      const result = grade(answer);

      expect(result).toMatchObject({ status: "incorrect", reason: "precision" });
      expect(result.message).toContain("2 decimal places");
    }
  });

  it("accepts surrounding whitespace, a plus sign, and a bare leading decimal point", () => {
    expect(grade("  4.37 ").status).toBe("correct");
    expect(grade("+4.37").status).toBe("correct");
    expect(evaluateAnswer(".50", 0.5, RULER_SPEC).status).toBe("correct");
  });

  it("accepts readings at the ends of the scale", () => {
    expect(evaluateAnswer("0.00", 0, RULER_SPEC).status).toBe("correct");
    expect(evaluateAnswer("15.00", 15, RULER_SPEC).status).toBe("correct");
  });
});

describe("evaluateAnswer with the graduated cylinder", () => {
  const reading = 23.4;
  const grade = (answer: string) => evaluateAnswer(answer, reading, CYLINDER_SPEC);

  it("marks the exact reading correct and states it", () => {
    const result = grade("23.4");

    expect(result.status).toBe("correct");
    expect(result.message).toContain("23.4 mL");
  });

  it("accepts answers up to 0.2 mL away on either side", () => {
    expect(grade("23.6").status).toBe("correct");
    expect(grade("23.2").status).toBe("correct");
  });

  it("rejects answers just past the tolerance on either side", () => {
    expect(grade("23.7")).toMatchObject({ status: "incorrect", reason: "value" });
    expect(grade("23.1")).toMatchObject({ status: "incorrect", reason: "value" });
  });

  it("requires the answer to one decimal place", () => {
    for (const answer of ["23", "23.40"]) {
      const result = grade(answer);

      expect(result).toMatchObject({ status: "incorrect", reason: "precision" });
      expect(result.message).toContain("1 decimal place");
    }
  });
});

describe("evaluateAnswer against the current instrument position", () => {
  it("grades the same answer differently when the reading changes", () => {
    expect(evaluateAnswer("4.37", 4.37, RULER_SPEC).status).toBe("correct");
    expect(evaluateAnswer("4.37", 11.62, RULER_SPEC).status).toBe("incorrect");
    expect(evaluateAnswer("41.7", 41.7, CYLINDER_SPEC).status).toBe("correct");
    expect(evaluateAnswer("41.7", 23.4, CYLINDER_SPEC).status).toBe("incorrect");
  });

  it("is not thrown off by floating-point error at the tolerance boundary", () => {
    // 0.1 + 0.2 is 0.30000000000000004, and 1.1 - 0.9 is 0.20000000000000007.
    expect(evaluateAnswer("0.32", 0.1 + 0.2, RULER_SPEC).status).toBe("correct");
    expect(evaluateAnswer("1.1", 0.9, CYLINDER_SPEC).status).toBe("correct");
  });
});

describe("evaluateAnswer input validation", () => {
  const grade = (answer: string) => evaluateAnswer(answer, 4.37, RULER_SPEC);

  it("rejects blank answers", () => {
    for (const answer of ["", "   ", "\t"]) {
      expect(grade(answer)).toMatchObject({ status: "invalid", code: "empty" });
    }
    expect(grade("").message).toBe("Enter your reading before checking your answer.");
  });

  it("rejects nonnumeric answers", () => {
    for (const answer of ["abc", "four", ".", "-", "cm"]) {
      expect(grade(answer)).toMatchObject({ status: "invalid", code: "not-a-number" });
    }
    expect(grade("abc").message).toContain("must be a number, like 12.35");
  });

  it("rejects malformed numbers", () => {
    for (const answer of ["1.2.3", "4.37cm", "4.37 cm", "1e3", "4,37", "4.", "4 .37", "--4.37"]) {
      expect(grade(answer)).toMatchObject({ status: "invalid", code: "malformed" });
    }
    expect(grade("4.37cm").message).toContain("no units");
  });

  it("rejects numbers outside the instrument's scale", () => {
    expect(grade("15.01")).toMatchObject({ status: "invalid", code: "out-of-range" });
    expect(grade("-0.50")).toMatchObject({ status: "invalid", code: "out-of-range" });
    expect(evaluateAnswer("50.1", 23.4, CYLINDER_SPEC)).toMatchObject({
      status: "invalid",
      code: "out-of-range",
    });
    expect(grade("15.01").message).toContain("from 0 to 15 cm");
  });

  it("uses an example with the instrument's precision", () => {
    expect(evaluateAnswer("abc", 23.4, CYLINDER_SPEC).message).toContain("like 12.3.");
  });
});
