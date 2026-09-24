import { describe, expect, it } from "vitest";

import {
  BOHR_MODEL_QUESTIONS,
  BOHR_QUESTIONS_PER_ATTEMPT,
} from "@/components/quiz/bohr/questions";
import {
  LEWIS_BONDING_QUESTIONS,
  LEWIS_QUESTIONS_PER_ATTEMPT,
} from "@/components/quiz/lewis/questions";
import { pickRandomQuestions } from "@/components/quiz/random";
import type { QuizQuestion } from "@/components/quiz/types";

const POOLS: [string, QuizQuestion[], number][] = [
  ["Bohr models", BOHR_MODEL_QUESTIONS, BOHR_QUESTIONS_PER_ATTEMPT],
  ["Lewis & bonding", LEWIS_BONDING_QUESTIONS, LEWIS_QUESTIONS_PER_ATTEMPT],
];

describe.each(POOLS)("%s question pool", (_name, pool, perAttempt) => {
  it("has unique question ids", () => {
    const ids = pool.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a valid correct answer and no duplicate options per question", () => {
    for (const question of pool) {
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(question.options.length);
      expect(new Set(question.options).size).toBe(question.options.length);
    }
  });

  it("has more questions than each attempt draws", () => {
    expect(pool.length).toBeGreaterThan(perAttempt);
  });

  it("draws a full attempt of distinct questions with the correct answer preserved", () => {
    const attempt = pickRandomQuestions(pool, perAttempt);

    expect(attempt).toHaveLength(perAttempt);
    expect(new Set(attempt.map((question) => question.id)).size).toBe(
      perAttempt,
    );

    for (const drawn of attempt) {
      const original = pool.find((question) => question.id === drawn.id)!;
      expect(drawn.options[drawn.correctIndex]).toBe(
        original.options[original.correctIndex],
      );
    }
  });
});
