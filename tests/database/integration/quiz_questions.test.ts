import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Requires supabase/migrations/20260924150000_quiz_questions.sql and
// 20260924150100_seed_bohr_quiz_questions.sql to be applied to the test project.

const options = {
  auth: { persistSession: false, autoRefreshToken: false },
};
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  options,
);
const anonymous = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options,
  );

const testQuizKey = `test_${randomUUID().replaceAll("-", "_")}`;
let signedIn: SupabaseClient;
let userId: string;
let hiddenQuestionId: string;
let visibleQuestionId: string;

beforeAll(async () => {
  const email = `quiz-questions-${randomUUID()}@example.com`;
  const password = `T!${randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  signedIn = anonymous();
  const login = await signedIn.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;

  const rows = await admin
    .from("quiz_questions")
    .insert([
      {
        quiz_key: testQuizKey,
        question_key: "visible",
        question: "Visible question?",
        options: ["a", "b"],
        correct_index: 0,
        order_index: 1,
        is_active: true,
      },
      {
        quiz_key: testQuizKey,
        question_key: "hidden",
        question: "Hidden question?",
        options: ["a", "b"],
        correct_index: 1,
        order_index: 2,
        is_active: false,
      },
    ])
    .select("id, question_key");
  if (rows.error) throw rows.error;
  visibleQuestionId = rows.data.find((row) => row.question_key === "visible")!.id;
  hiddenQuestionId = rows.data.find((row) => row.question_key === "hidden")!.id;
}, 60_000);

afterAll(async () => {
  const errors: string[] = [];
  const removed = await admin.from("quiz_questions").delete().eq("quiz_key", testQuizKey);
  if (removed.error) errors.push(removed.error.message);
  if (userId) {
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error) errors.push(result.error.message);
  }
  if (errors.length) throw new Error(`Fixture cleanup failed: ${errors.join("; ")}`);
}, 60_000);

describe("quiz_questions RLS", () => {
  it("denies anonymous reads and writes", async () => {
    const client = anonymous();
    const read = await client.from("quiz_questions").select("id");
    expect(read.error).not.toBeNull();
    expect(read.data).toBeNull();

    const write = await client.from("quiz_questions").insert({
      quiz_key: testQuizKey,
      question_key: "anon",
      question: "Anon?",
      options: ["a", "b"],
      correct_index: 0,
    });
    expect(write.error).not.toBeNull();
  });

  it("lets a signed-in user read active questions and hides inactive ones", async () => {
    const result = await signedIn
      .from("quiz_questions")
      .select("id, question_key")
      .eq("quiz_key", testQuizKey);

    expect(result.error).toBeNull();
    expect(result.data?.map((row) => row.id)).toEqual([visibleQuestionId]);
    expect(result.data?.map((row) => row.id)).not.toContain(hiddenQuestionId);
  });

  it("has the moved Bohr questions available to a signed-in user", async () => {
    const result = await signedIn
      .from("quiz_questions")
      .select("question_key")
      .eq("quiz_key", "bohr_models");

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(36);
  });

  it("has the moved Lewis questions available to a signed-in user", async () => {
    const result = await signedIn
      .from("quiz_questions")
      .select("question_key")
      .eq("quiz_key", "lewis_bonding");

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(38);
  });

  it("denies question mutations from a signed-in user", async () => {
    const inserted = await signedIn.from("quiz_questions").insert({
      quiz_key: testQuizKey,
      question_key: "unauthorized",
      question: "Nope?",
      options: ["a", "b"],
      correct_index: 0,
    });
    const updated = await signedIn
      .from("quiz_questions")
      .update({ question: "Changed" })
      .eq("id", visibleQuestionId);
    const deleted = await signedIn
      .from("quiz_questions")
      .delete()
      .eq("id", visibleQuestionId);

    expect(inserted.error).not.toBeNull();
    expect(updated.error).not.toBeNull();
    expect(deleted.error).not.toBeNull();

    const unchanged = await admin
      .from("quiz_questions")
      .select("question")
      .eq("id", visibleQuestionId)
      .single();
    expect(unchanged.data?.question).toBe("Visible question?");
  });
});

describe("quiz_questions constraints", () => {
  it.each([
    ["an out-of-range answer index", { options: ["a", "b"], correct_index: 2 }],
    ["a negative answer index", { options: ["a", "b"], correct_index: -1 }],
    ["fewer than two choices", { options: ["a"], correct_index: 0 }],
    ["choices that are not an array", { options: { a: 1 }, correct_index: 0 }],
  ])("rejects %s (pg error 23514)", async (_, invalid) => {
    const result = await admin.from("quiz_questions").insert({
      quiz_key: testQuizKey,
      question_key: `bad-${randomUUID()}`,
      question: "Bad?",
      ...invalid,
    });

    expect(result.error?.code).toBe("23514");
  });

  it("rejects a duplicate question key within a quiz (pg error 23505)", async () => {
    const result = await admin.from("quiz_questions").insert({
      quiz_key: testQuizKey,
      question_key: "visible",
      question: "Duplicate?",
      options: ["a", "b"],
      correct_index: 0,
    });

    expect(result.error?.code).toBe("23505");
  });
});
