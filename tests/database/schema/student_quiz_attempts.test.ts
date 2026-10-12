import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// These tests write disposable fixtures. Use a dedicated test Supabase project.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let classId: string;
let progressId: string;
const attemptIds: string[] = [];

const completedAt = "2026-10-07T12:05:00Z";
const startedAt = "2026-10-07T12:00:00Z";

beforeAll(async () => {
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers").select("id").limit(1).single();
  if (teacherError) throw teacherError;

  const { data: activity, error: activityError } = await supabase
    .from("activities").select("id").eq("type", "bohr_model_intro").limit(1).single();
  if (activityError) throw activityError;

  const { data: classroom, error: classError } = await supabase.from("classes")
    .insert({
      teacher_id: teacher.id,
      name: "Quiz attempt schema test",
      section: "Test",
      class_code: randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase(),
    })
    .select("id")
    .single();
  if (classError) throw classError;
  classId = classroom.id;

  const { data: student, error: studentError } = await supabase.from("students")
    .insert({
      class_id: classId,
      first_name: "Quiz",
      last_name: "Schema",
      student_id: `test-${randomUUID()}`,
      verified: true,
    })
    .select("id")
    .single();
  if (studentError) throw studentError;

  const { data: assignment, error: assignmentError } = await supabase
    .from("class_activities")
    .insert({ class_id: classId, activity_id: activity.id })
    .select("id")
    .single();
  if (assignmentError) throw assignmentError;

  const { data: progress, error: progressError } = await supabase
    .from("student_progress")
    .insert({ student_id: student.id, class_activity_id: assignment.id })
    .select("id")
    .single();
  if (progressError) throw progressError;
  progressId = progress.id;
});

afterEach(async () => {
  if (attemptIds.length === 0) return;
  const { error } = await supabase
    .from("student_attempts")
    .delete()
    .in("id", attemptIds.splice(0));
  if (error) throw error;
});

afterAll(async () => {
  if (!classId) return;
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) throw error;
});

function quizAttempt(overrides: Record<string, unknown> = {}) {
  return {
    progress_id: progressId,
    attempt_number: 1,
    quiz_key: "bohr_models",
    question_total: 12,
    score: 10,
    percentage: 83.33,
    passed: true,
    submission_key: randomUUID(),
    status: "completed",
    started_at: startedAt,
    completed_at: completedAt,
    ...overrides,
  };
}

async function insertAttempt(values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("student_attempts")
    .insert(values)
    .select("*")
    .single();
  if (data?.id) attemptIds.push(data.id);
  return { data, error };
}

describe("student_attempts quiz metadata schema", () => {
  it("accepts valid passing and failing quiz results", async () => {
    const passing = await insertAttempt(quizAttempt());
    expect(passing.error).toBeNull();
    expect(passing.data).toMatchObject({
      quiz_key: "bohr_models",
      question_total: 12,
      score: 10,
      percentage: 83.33,
      passed: true,
      status: "completed",
    });

    const failing = await insertAttempt(quizAttempt({
      attempt_number: 2,
      score: 9,
      percentage: 75,
      passed: false,
      submission_key: randomUUID(),
    }));
    expect(failing.error).toBeNull();
    expect(failing.data?.passed).toBe(false);
  });

  it.each([
    { score: 13, percentage: 108.33 },
    { score: -1, percentage: -8.33 },
    { score: 9, percentage: 75, passed: true },
    { score: 10, percentage: 83.33, passed: false },
    { score: 10, percentage: 80 },
  ])("rejects inconsistent quiz metadata: %j", async (overrides) => {
    const { error } = await insertAttempt(quizAttempt(overrides));
    expect(error?.code).toBe("23514");
  });

  it("allows exploration and quiz attempts to share a progress record", async () => {
    const exploration = await insertAttempt({
      progress_id: progressId,
      attempt_number: 1,
      submission_key: null,
      status: "in_progress",
      started_at: startedAt,
      completed_at: null,
    });
    expect(exploration.error).toBeNull();

    const quiz = await insertAttempt(quizAttempt());
    expect(quiz.error).toBeNull();
  });

  it("scopes attempt-number uniqueness by quiz identity", async () => {
    const first = await insertAttempt(quizAttempt());
    expect(first.error).toBeNull();

    const duplicateQuiz = await insertAttempt(quizAttempt({
      submission_key: randomUUID(),
    }));
    expect(duplicateQuiz.error?.code).toBe("23505");

    const otherQuiz = await insertAttempt(quizAttempt({
      quiz_key: "lewis_covalent",
      submission_key: randomUUID(),
    }));
    expect(otherQuiz.error).toBeNull();
  });

  it("enforces unique idempotency keys", async () => {
    const submissionKey = randomUUID();
    const first = await insertAttempt({
      ...quizAttempt(),
      submission_key: submissionKey,
    });
    expect(first.error).toBeNull();

    const duplicate = await insertAttempt({
      ...quizAttempt({ attempt_number: 2 }),
      submission_key: submissionKey,
    });
    expect(duplicate.error?.code).toBe("23505");
  });

  it("allows one active exploration and one active quiz attempt together", async () => {
    const exploration = await insertAttempt({
      progress_id: progressId,
      attempt_number: 1,
      submission_key: null,
      status: "in_progress",
      started_at: startedAt,
      completed_at: null,
    });
    expect(exploration.error).toBeNull();

    const quiz = await insertAttempt(quizAttempt({
      status: "in_progress",
      completed_at: null,
    }));
    expect(quiz.error).toBeNull();
  });
});
