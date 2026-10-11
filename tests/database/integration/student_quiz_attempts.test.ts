import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let classId: string | undefined;
let studentId: string;
let assignmentId: string;
let passAnswers: Array<{ questionId: string; selectedIndex: number }>;

beforeAll(async () => {
  const { data: teacher, error: teacherError } = await client
    .from("teachers").select("id").limit(1).single();
  if (teacherError) throw teacherError;

  const { data: activity, error: activityError } = await client
    .from("activities").select("id").eq("type", "bohr_model_intro").limit(1).single();
  if (activityError) throw activityError;

  const { data: classroom, error: classError } = await client.from("classes")
    .insert({
      teacher_id: teacher.id,
      name: "Quiz replay test",
      section: "Test",
      class_code: randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase(),
    })
    .select("id")
    .single();
  if (classError) throw classError;
  classId = classroom.id;

  const { data: student, error: studentError } = await client.from("students")
    .insert({
      class_id: classId,
      first_name: "Quiz",
      last_name: "Replay",
      student_id: `test-${randomUUID()}`,
      verified: true,
    })
    .select("id")
    .single();
  if (studentError) throw studentError;
  studentId = student.id;

  const { data: assignment, error: assignmentError } = await client
    .from("class_activities")
    .insert({ class_id: classId, activity_id: activity.id })
    .select("id")
    .single();
  if (assignmentError) throw assignmentError;
  assignmentId = assignment.id;

  const { data: questions, error: questionError } = await client
    .from("quiz_questions")
    .select("question_key, correct_index, order_index")
    .eq("quiz_key", "bohr_models")
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .limit(12);
  if (questionError) throw questionError;
  if (!questions || questions.length < 12) {
    throw new Error("At least 12 active Bohr questions are required.");
  }

  passAnswers = questions.map((question) => ({
    questionId: question.question_key,
    selectedIndex: question.correct_index,
  }));
});

afterAll(async () => {
  if (!classId) return;
  const { error } = await client.from("classes").delete().eq("id", classId);
  if (error) throw error;
});

describe("student quiz attempt replay", () => {
  it("returns one immutable attempt for concurrent replays of one submission", async () => {
    const submissionKey = `concurrent-${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 6 }, () => client.rpc("student_quiz_submit", {
        p_student_id: studentId,
        p_class_id: classId,
        p_assignment_id: assignmentId,
        p_quiz_key: "bohr_models",
        p_submission_key: submissionKey,
        p_answers: passAnswers,
      })),
    );

    for (const result of results) expect(result.error).toBeNull();
    const attempts = results.map((result) => result.data?.[0]);
    expect(new Set(attempts.map((attempt) => attempt.id)).size).toBe(1);
    expect(attempts[0]).toMatchObject({
      attempt_number: expect.any(Number),
      score: 12,
      question_total: 12,
      percentage: 100,
      passed: true,
      status: "completed",
    });
  }, 30000);
});
