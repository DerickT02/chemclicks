import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BOHR_QUIZ_KEY, listQuizQuestions } from "@/lib/db/quiz-questions";

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as SupabaseClient, from, calls };
}

const row = {
  question_key: "bohr-boron-outer",
  question: "How many electrons does boron have in its outer shell?",
  options: ["2", "5", "8", "3"],
  correct_index: 3,
};

describe("listQuizQuestions", () => {
  it("reads only the active questions for the requested quiz, in authored order", async () => {
    const { client, from, calls } = fakeClient({ data: [row], error: null });

    await listQuizQuestions(client, BOHR_QUIZ_KEY);

    expect(from).toHaveBeenCalledWith("quiz_questions");
    expect(calls).toContainEqual(["eq", "quiz_key", "bohr_models"]);
    expect(calls).toContainEqual(["eq", "is_active", true]);
    expect(calls.filter(([method]) => method === "order")).toEqual([
      ["order", "order_index", { ascending: true }],
      ["order", "question_key", { ascending: true }],
    ]);
  });

  it("maps rows to the quiz question shape the quiz shell already uses", async () => {
    const { client } = fakeClient({ data: [row], error: null });

    const result = await listQuizQuestions(client, BOHR_QUIZ_KEY);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        id: "bohr-boron-outer",
        question: row.question,
        options: ["2", "5", "8", "3"],
        correctIndex: 3,
      },
    ]);
  });

  it("returns an empty list, not an error, when a quiz has no questions", async () => {
    const { client } = fakeClient({ data: [], error: null });

    expect(await listQuizQuestions(client, BOHR_QUIZ_KEY)).toEqual({
      data: [],
      error: null,
    });
  });

  it("passes a database error through instead of returning an empty list", async () => {
    const dbError = { code: "42501", message: "permission denied" };
    const { client } = fakeClient({ data: null, error: dbError });

    expect(await listQuizQuestions(client, BOHR_QUIZ_KEY)).toEqual({
      data: null,
      error: dbError,
    });
  });

  it.each([
    ["options is not an array", { ...row, options: "2,5,8,3" }],
    ["fewer than two choices", { ...row, options: ["only"], correct_index: 0 }],
    ["a choice is not a string", { ...row, options: ["2", 5, "8", "3"] }],
    ["the answer index is out of range", { ...row, correct_index: 4 }],
    ["the answer index is negative", { ...row, correct_index: -1 }],
  ])("fails the whole read when a row is malformed (%s)", async (_, bad) => {
    const { client } = fakeClient({ data: [row, bad], error: null });

    const result = await listQuizQuestions(client, BOHR_QUIZ_KEY);

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("invalid_quiz_question");
    expect(result.error?.message).toContain("bohr-boron-outer");
  });
});
