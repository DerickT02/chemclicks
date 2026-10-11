import { describe, expect, it } from "vitest";

import { evaluateAnswer } from "../../src/lib/measurement/answer";
import { CYLINDER_SPEC, RULER_SPEC } from "../../src/lib/measurement/instruments";

describe("evaluateAnswer with the ruler", () => {
  const reading = 4.3;
  const grade = (answer: string) => evaluateAnswer(answer, reading, RULER_SPEC);

  it("marks the exact reading correct and states it", () => {
    const result = grade("4.3");

    expect(result.status).toBe("correct");
    expect(result.message).toContain("4.3 cm");
  });

  it("accepts answers up to 0.1 cm away on either side", () => {
    expect(grade("4.4").status).toBe("correct");
    expect(grade("4.2").status).toBe("correct");
    expect(grade("4.4").message).toContain("±0.1 cm");
  });

  it("rejects answers just past the tolerance on either side", () => {
    expect(grade("4.5")).toMatchObject({ status: "incorrect", reason: "value" });
    expect(grade("4.1")).toMatchObject({ status: "incorrect", reason: "value" });
  });

  it("does not reveal the reading in incorrect feedback", () => {
    expect(grade("4.5").message).not.toContain("4.3");
  });

  it("requires the answer to one decimal place", () => {
    for (const answer of ["4.30", "4", "4.300"]) {
      const result = grade(answer);

      expect(result).toMatchObject({ status: "incorrect", reason: "precision" });
      expect(result.message).toContain("1 decimal place");
    }
  });

  it("accepts surrounding whitespace, a plus sign, and a bare leading decimal point", () => {
    expect(grade("  4.3 ").status).toBe("correct");
    expect(grade("+4.3").status).toBe("correct");
    expect(evaluateAnswer(".5", 0.5, RULER_SPEC).status).toBe("correct");
  });

  it("accepts readings at the ends of the scale", () => {
    expect(evaluateAnswer("0.0", 0, RULER_SPEC).status).toBe("correct");
    expect(evaluateAnswer("10.0", 10, RULER_SPEC).status).toBe("correct");
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
    expect(evaluateAnswer("4.3", 4.3, RULER_SPEC).status).toBe("correct");
    expect(evaluateAnswer("4.3", 6.6, RULER_SPEC).status).toBe("incorrect");
    expect(evaluateAnswer("41.7", 41.7, CYLINDER_SPEC).status).toBe("correct");
    expect(evaluateAnswer("41.7", 23.4, CYLINDER_SPEC).status).toBe("incorrect");
  });

  it("is not thrown off by floating-point error at the tolerance boundary", () => {
    // 0.1 + 0.2 is 0.30000000000000004, and 1.1 - 0.9 is 0.20000000000000007.
    expect(evaluateAnswer("0.4", 0.1 + 0.2, RULER_SPEC).status).toBe("correct");
    expect(evaluateAnswer("1.1", 0.9, CYLINDER_SPEC).status).toBe("correct");
  });
});

describe("evaluateAnswer input validation", () => {
  const grade = (answer: string) => evaluateAnswer(answer, 4.3, RULER_SPEC);

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
    expect(grade("abc").message).toContain("must be a number, like 5.0");
  });

  it("rejects malformed numbers", () => {
    for (const answer of ["1.2.3", "4.37cm", "4.37 cm", "1e3", "4,37", "4.", "4 .37", "--4.37"]) {
      expect(grade(answer)).toMatchObject({ status: "invalid", code: "malformed" });
    }
    expect(grade("4.37cm").message).toContain("no units");
  });

  it("rejects numbers outside the instrument's scale", () => {
    expect(grade("10.01")).toMatchObject({ status: "invalid", code: "out-of-range" });
    expect(grade("-0.50")).toMatchObject({ status: "invalid", code: "out-of-range" });
    expect(evaluateAnswer("50.1", 23.4, CYLINDER_SPEC)).toMatchObject({
      status: "invalid",
      code: "out-of-range",
    });
    expect(grade("10.01").message).toContain("from 0 to 10 cm");
  });

  it("uses an example with the instrument's precision", () => {
    expect(evaluateAnswer("abc", 23.4, CYLINDER_SPEC).message).toContain("like 12.3.");
  });
});
