import { describe, expect, it } from "vitest";
import { pickRandomQuestions, shuffleQuestionOptions } from "@/components/quiz/random";
import type { QuizQuestion } from "@/components/quiz/types";

function makePool(size: number): QuizQuestion[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `q-${index + 1}`,
    question: `Question ${index + 1}?`,
    options: [`right-${index + 1}`, "wrong a", "wrong b", "wrong c"],
    correctIndex: 0,
  }));
}

describe("pickRandomQuestions", () => {
  it("draws the requested number of distinct questions", () => {
    const attempt = pickRandomQuestions(makePool(30), 12);

    expect(attempt).toHaveLength(12);
    expect(new Set(attempt.map((question) => question.id)).size).toBe(12);
  });

  it("uses every question when the pool is smaller than the attempt", () => {
    expect(pickRandomQuestions(makePool(5), 12)).toHaveLength(5);
  });

  it("does not change the pool it draws from", () => {
    const pool = makePool(15);
    const before = JSON.stringify(pool);

    pickRandomQuestions(pool, 12);

    expect(JSON.stringify(pool)).toBe(before);
  });

  it("keeps the correct answer attached to its question after shuffling", () => {
    const pool = makePool(30);

    for (const drawn of pickRandomQuestions(pool, 30)) {
      const original = pool.find((question) => question.id === drawn.id)!;
      expect(drawn.options[drawn.correctIndex]).toBe(
        original.options[original.correctIndex],
      );
      expect([...drawn.options].sort()).toEqual([...original.options].sort());
    }
  });
});

describe("shuffleQuestionOptions", () => {
  it("returns a valid correct index for the shuffled options", () => {
    const shuffled = shuffleQuestionOptions(makePool(1)[0]);

    expect(shuffled.correctIndex).toBeGreaterThanOrEqual(0);
    expect(shuffled.correctIndex).toBeLessThan(shuffled.options.length);
    expect(shuffled.options[shuffled.correctIndex]).toBe("right-1");
  });
});
