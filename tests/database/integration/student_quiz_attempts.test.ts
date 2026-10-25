import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const databaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedTestProjectRef = process.env.SUPABASE_TEST_PROJECT_REF;

if (!databaseUrl || !serviceRoleKey || !expectedTestProjectRef) {
  throw new Error("Set the Supabase URL, service-role key, and SUPABASE_TEST_PROJECT_REF in .env.test.local.");
}

const databaseHost = new URL(databaseUrl).hostname;
const actualTestProjectRef = ["localhost", "127.0.0.1", "::1"].includes(databaseHost)
  ? "local"
  : databaseHost.split(".")[0];

if (actualTestProjectRef !== expectedTestProjectRef) {
  throw new Error("The configured Supabase URL does not match SUPABASE_TEST_PROJECT_REF.");
}

const client = createClient(
  databaseUrl,
  serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let classId: string | undefined;
let teacherId: string;
let studentId: string;
let unverifiedStudentId: string;
let assignmentId: string;
let passAnswers: Array<{ questionId: string; selectedIndex: number }>;
let failAnswers: Array<{ questionId: string; selectedIndex: number }>;

beforeAll(async () => {
  const { data: teacher, error: teacherError } = await client
    .from("teachers").select("id").limit(1).single();
  if (teacherError) throw teacherError;
  teacherId = teacher.id;

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

  const { data: unverified, error: unverifiedError } = await client.from("students")
    .insert({
      class_id: classId,
      first_name: "Unverified",
      last_name: "Student",
      student_id: `test-${randomUUID()}`,
      verified: false,
    })
    .select("id")
    .single();
  if (unverifiedError) throw unverifiedError;
  unverifiedStudentId = unverified.id;

  const { data: assignment, error: assignmentError } = await client
    .from("class_activities")
    .insert({ class_id: classId, activity_id: activity.id })
    .select("id")
    .single();
  if (assignmentError) throw assignmentError;
  assignmentId = assignment.id;

  const { data: questions, error: questionError } = await client
    .from("quiz_questions")
    .select("question_key, correct_index, order_index, options")
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
  if (questions.some((question) => question.options.length < 2)) {
    throw new Error("Every active Bohr question needs at least two answer choices.");
  }
  failAnswers = questions.map((question) => ({
    questionId: question.question_key,
    selectedIndex: question.correct_index === 0 ? 1 : 0,
  }));
});

afterAll(async () => {
  if (!classId) return;
  const { error } = await client.from("classes").delete().eq("id", classId);
  if (error) throw error;
});

describe("student quiz attempt replay", () => {
  it("tracks stages and timers while blocking duplicate and stale-tab submissions", async () => {
    const report = async () => {
      const result = await client.rpc("teacher_activity_attempt_summary", {
        p_teacher_id: teacherId,
        p_class_id: classId,
        p_assignment_id: assignmentId,
      });
      expect(result.error).toBeNull();
      const summary = result.data as {
        students: Array<{
          studentId: string;
          stage: string;
          firstQuizStartedAt: string | null;
          quizStartedAt: string | null;
          explorationStartedAt: string | null;
          explorationDurationSeconds: number | null;
          attempts: Array<{ id: string; status: string; startedAt: string; completedAt: string | null }>;
        }>;
      };
      return summary.students.find((row) => row.studentId === studentId)!;
    };

    expect(await report()).toMatchObject({
      stage: "Not started",
      firstQuizStartedAt: null,
      quizStartedAt: null,
      explorationStartedAt: null,
      explorationDurationSeconds: null,
      attempts: [],
    });

    const exploration = await client.rpc("student_attempt_transition", {
      p_student_id: studentId,
      p_class_id: classId,
      p_assignment_id: assignmentId,
      p_action: "start",
      p_attempt_id: null,
    });
    expect(exploration.error).toBeNull();
    expect(await report()).toMatchObject({ stage: "Exploring" });

    const { error: backdateError } = await client.from("student_progress")
      .update({ exploration_started_at: new Date(Date.now() - 180_000).toISOString() })
      .eq("student_id", studentId)
      .eq("class_activity_id", assignmentId);
    expect(backdateError).toBeNull();

    // Caller-controlled identities, activity/quiz mismatches and an
    // unverified enrollment must not create progress or timer rows.
    for (const input of [
      { p_student_id: unverifiedStudentId, p_quiz_key: "bohr_models" },
      { p_student_id: randomUUID(), p_quiz_key: "bohr_models" },
      { p_student_id: studentId, p_quiz_key: "lewis_covalent" },
    ]) {
      const rejected = await client.rpc("student_quiz_start", {
        p_student_id: input.p_student_id,
        p_class_id: classId,
        p_assignment_id: assignmentId,
        p_quiz_key: input.p_quiz_key,
      });
      expect(rejected.error?.code).toBe("42501");
      expect(rejected.data).toBeNull();
    }

    const start = await client.rpc("student_quiz_start", {
      p_student_id: studentId,
      p_class_id: classId,
      p_assignment_id: assignmentId,
      p_quiz_key: "bohr_models",
    });
    expect(start.error).toBeNull();
    const started = start.data as { status: string; progress_id: string; started_at: string };
    expect(started.status).toBe("in_progress");
    const initialStartedAt = started.started_at;

    const progressResult = await client.from("student_progress")
      .select("first_quiz_started_at, quiz_started_at, exploration_started_at, exploration_duration_seconds")
      .eq("id", started.progress_id)
      .single();
    expect(progressResult.error).toBeNull();
    expect(progressResult.data?.first_quiz_started_at).toBe(initialStartedAt);
    expect(progressResult.data?.quiz_started_at).toBe(initialStartedAt);
    expect(progressResult.data?.exploration_started_at).not.toBeNull();
    expect(progressResult.data?.exploration_duration_seconds).toBeGreaterThanOrEqual(175);
    expect((await report()).stage).toBe("Taking quiz");

    const replayedStart = await client.rpc("student_quiz_start", {
      p_student_id: studentId,
      p_class_id: classId,
      p_assignment_id: assignmentId,
      p_quiz_key: "bohr_models",
    });
    expect((replayedStart.data as { started_at: string }).started_at).toBe(initialStartedAt);

    const earlyRetry = await client.rpc("student_quiz_retry_start", {
      p_student_id: studentId,
      p_class_id: classId,
      p_assignment_id: assignmentId,
      p_quiz_key: "bohr_models",
    });
    expect(earlyRetry.error?.code).toBe("42501");

    const submit = (submissionKey: string, quizStartedAt: string, answers: typeof passAnswers) =>
      client.rpc("student_quiz_submit", {
        p_student_id: studentId,
        p_class_id: classId,
        p_assignment_id: assignmentId,
        p_quiz_key: "bohr_models",
        p_quiz_started_at: quizStartedAt,
        p_submission_key: submissionKey,
        p_answers: answers,
      });

    const invalidSubmissions = [
      {
        key: "forged-start",
        quizStartedAt: new Date(Date.parse(initialStartedAt) + 1_000).toISOString(),
        answers: passAnswers,
        code: "42501",
      },
      {
        key: "short-answer-list",
        quizStartedAt: initialStartedAt,
        answers: passAnswers.slice(1),
        code: "22023",
      },
      {
        key: "duplicate-question",
        quizStartedAt: initialStartedAt,
        answers: [...passAnswers.slice(0, -1), passAnswers[0]],
        code: "22023",
      },
      {
        key: "unknown-question",
        quizStartedAt: initialStartedAt,
        answers: passAnswers.map((answer, index) => index === 0
          ? { ...answer, questionId: "not-in-this-quiz" }
          : answer),
        code: "22023",
      },
      {
        key: "out-of-range-answer",
        quizStartedAt: initialStartedAt,
        answers: passAnswers.map((answer, index) => index === 0
          ? { ...answer, selectedIndex: 999 }
          : answer),
        code: "22023",
      },
      {
        key: "negative-answer",
        quizStartedAt: initialStartedAt,
        answers: passAnswers.map((answer, index) => index === 0
          ? { ...answer, selectedIndex: -1 }
          : answer),
        code: "22023",
      },
    ];
    for (const invalid of invalidSubmissions) {
      const rejected = await submit(invalid.key, invalid.quizStartedAt, invalid.answers);
      expect(rejected.error?.code, invalid.key).toBe(invalid.code);
      expect(rejected.data, invalid.key).toBeNull();
    }
    const { count: invalidResultCount, error: invalidCountError } = await client.from("student_attempts")
      .select("id", { count: "exact", head: true })
      .eq("progress_id", started.progress_id)
      .eq("quiz_key", "bohr_models");
    expect(invalidCountError).toBeNull();
    expect(invalidResultCount).toBe(0);

    // Different tabs can choose different submission keys. They still share
    // one locked start, so only the first result may create an attempt.
    const submissions = Array.from({ length: 6 }, (_, index) => ({
      key: `concurrent-${randomUUID()}`,
      answers: index % 2 === 0 ? failAnswers : passAnswers,
    }));
    const results = await Promise.all(
      submissions.map(({ key, answers }) => submit(key, initialStartedAt, answers)),
    );

    for (const result of results) expect(result.error).toBeNull();
    const attempts = results.map((result) => result.data?.[0]);
    expect(new Set(attempts.map((attempt) => attempt.id)).size).toBe(1);
    expect(attempts[0]).toMatchObject({
      attempt_number: 1,
      started_at: initialStartedAt,
      question_total: 12,
      status: "completed",
    });
    expect(new Set(attempts.map((attempt) => attempt.score)).size).toBe(1);
    expect([0, 12]).toContain(attempts[0].score);
    expect(attempts[0].passed).toBe(attempts[0].score === 12);

    const { count: oneResultCount, error: oneResultError } = await client.from("student_attempts")
      .select("id", { count: "exact", head: true })
      .eq("progress_id", started.progress_id)
      .eq("quiz_key", "bohr_models");
    expect(oneResultError).toBeNull();
    expect(oneResultCount).toBe(1);
    expect(["Needs retry", "Completed"]).toContain((await report()).stage);

    const reloadStart = await client.rpc("student_quiz_start", {
      p_student_id: studentId,
      p_class_id: classId,
      p_assignment_id: assignmentId,
      p_quiz_key: "bohr_models",
    });
    expect(reloadStart.error).toBeNull();
    expect(reloadStart.data).toMatchObject({ status: "retry_required" });

    const retries = await Promise.all(Array.from({ length: 6 }, () => client.rpc("student_quiz_retry_start", {
      p_student_id: studentId,
      p_class_id: classId,
      p_assignment_id: assignmentId,
      p_quiz_key: "bohr_models",
    })));
    for (const retry of retries) expect(retry.error).toBeNull();
    const retryTimes = retries.map((retry) => (retry.data as { started_at: string }).started_at);
    expect(new Set(retryTimes).size).toBe(1);
    const retryStartedAt = retryTimes[0];
    expect(Date.parse(retryStartedAt)).toBeGreaterThan(Date.parse(initialStartedAt));
    expect((await report()).stage).toBe("Taking quiz");

    const reusedSubmissionKey = await submit(submissions[0].key, retryStartedAt, passAnswers);
    expect(reusedSubmissionKey.error?.code).toBe("22023");
    expect(reusedSubmissionKey.data).toBeNull();

    const staleTab = await submit(`stale-${randomUUID()}`, initialStartedAt, passAnswers);
    expect(staleTab.error?.code).toBe("42501");
    expect(staleTab.data).toBeNull();

    const retryResult = await submit(`retry-${randomUUID()}`, retryStartedAt, passAnswers);
    expect(retryResult.error).toBeNull();
    expect(retryResult.data?.[0]).toMatchObject({
      attempt_number: 2,
      started_at: retryStartedAt,
      passed: true,
    });
    expect((await report()).stage).toBe("Completed");

    const finalProgress = await client.from("student_progress")
      .select("first_quiz_started_at, quiz_started_at, exploration_duration_seconds")
      .eq("id", started.progress_id)
      .single();
    expect(finalProgress.error).toBeNull();
    expect(finalProgress.data).toEqual({
      first_quiz_started_at: initialStartedAt,
      quiz_started_at: retryStartedAt,
      exploration_duration_seconds: progressResult.data?.exploration_duration_seconds,
    });

    const archived = await client.from("class_activities")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", assignmentId);
    expect(archived.error).toBeNull();
    const archivedRetry = await client.rpc("student_quiz_retry_start", {
      p_student_id: studentId,
      p_class_id: classId,
      p_assignment_id: assignmentId,
      p_quiz_key: "bohr_models",
    });
    expect(archivedRetry.error?.code).toBe("42501");
  }, 30000);
});
