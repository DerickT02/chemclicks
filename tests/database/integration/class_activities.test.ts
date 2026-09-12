import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getClassActivities, insertClassActivity, updateClassActivity } from "@/lib/db/class_activities";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ value: null as null | { studentId: string; classId: string; expiresAt: number } }));
vi.mock("@/lib/auth/student-session", () => ({ getStudentSession: async () => session.value }));
import { getStudentAssignments } from "@/lib/db/student-assignments";

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
const anonymous = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
const userIds: string[] = [];
const classIds: string[] = [];
let teacherA: SupabaseClient;
let teacherB: SupabaseClient;
let activityId: string;
let studentId: string;
let classA: string;
let classB: string;

async function createTeacher(): Promise<SupabaseClient> {
  const email = `assignment-${randomUUID()}@example.com`;
  const password = `T!${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  userIds.push(id);
  const inserted = await admin.from("teachers").upsert({ id, email, display_name: "Assignment test" });
  if (inserted.error) throw inserted.error;
  const classroom = await admin.from("classes").insert({
    teacher_id: id, name: "Assignment test", section: "Test", class_code: randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase(),
  }).select("id").single();
  if (classroom.error) throw classroom.error;
  classIds.push(classroom.data.id);
  const client = anonymous();
  const auth = await client.auth.signInWithPassword({ email, password });
  if (auth.error) throw auth.error;
  return client;
}

beforeAll(async () => {
  const activity = await admin.from("activities").select("id").limit(1).single();
  if (activity.error) throw new Error("Assignment tests require one existing catalog activity.");
  activityId = activity.data.id;
  teacherA = await createTeacher();
  teacherB = await createTeacher();
  [classA, classB] = classIds;
  const student = await admin.from("students").insert({
    class_id: classA, first_name: "Assignment", last_name: "Test", student_id: `test-${randomUUID()}`,
  }).select("id").single();
  if (student.error) throw student.error;
  studentId = student.data.id;
}, 60_000);

beforeEach(async () => {
  session.value = { studentId, classId: classA, expiresAt: Date.now() + 100000 };
  const result = await admin.from("class_activities").delete().in("class_id", classIds);
  if (result.error) throw result.error;
});
afterEach(() => vi.useRealTimers());
afterAll(async () => {
  // Only IDs created by this suite are ever deleted.
  const errors: string[] = [];
  if (classIds.length) {
    const result = await admin.from("classes").delete().in("id", classIds);
    if (result.error) errors.push(result.error.message);
  }
  for (const id of userIds) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) errors.push(result.error.message);
  }
  if (errors.length) throw new Error(`Fixture cleanup failed: ${errors.join("; ")}`);
}, 60_000);

async function assign(classId = classA, dates: { opens_at?: string | null; closes_at?: string | null } = {}) {
  const result = await insertClassActivity(admin, { class_id: classId, activity_id: activityId, ...dates });
  if (result.error || !result.data) throw new Error(result.error?.message ?? "Assignment insert failed");
  return result.data;
}

describe("class assignments persistence and RLS", () => {
  it("persists optional dates and preserves assignment ID on updates", async () => {
    const created = await insertClassActivity(teacherA, { class_id: classA, activity_id: activityId });
    expect(created.error).toBeNull();
    expect(created.data).toMatchObject({ class_id: classA, activity_id: activityId, opens_at: null, closes_at: null });
    const id = created.data!.id;
    const updated = await updateClassActivity(teacherA, id, { opens_at: "2026-09-12T10:00:00Z", closes_at: "2026-09-12T11:00:00Z" });
    expect(updated.error).toBeNull();
    expect(updated.data!.id).toBe(id);
    expect(Date.parse(updated.data!.opens_at!)).toBe(Date.parse("2026-09-12T10:00:00Z"));
    const cleared = await updateClassActivity(teacherA, id, { opens_at: null });
    expect(cleared.error).toBeNull();
    expect(cleared.data!.opens_at).toBeNull();
    expect(cleared.data!.closes_at).toBe(updated.data!.closes_at);
    expect((await getClassActivities(teacherA, classA)).data).toHaveLength(1);
  });

  it("rejects missing IDs and invalid ranges without inserting", async () => {
    expect((await insertClassActivity(teacherA, { class_id: "", activity_id: activityId })).error?.code).toBe("VALIDATION_ERROR");
    expect((await insertClassActivity(teacherA, { class_id: classA, activity_id: activityId, opens_at: "bad" })).error?.code).toBe("VALIDATION_ERROR");
    expect((await insertClassActivity(teacherA, { class_id: classA, activity_id: activityId, opens_at: "2026-09-12T12:00:00Z", closes_at: "2026-09-12T12:00:00Z" })).error?.code).toBe("VALIDATION_ERROR");
    expect((await getClassActivities(teacherA, classA)).data).toHaveLength(0);
  });

  it("enforces date ranges and foreign keys even when bypassing helper validation", async () => {
    const invalid = await admin.from("class_activities").insert({ class_id: classA, activity_id: activityId, opens_at: "2026-09-13T00:00:00Z", closes_at: "2026-09-12T00:00:00Z" });
    expect(invalid.error?.code).toBe("23514");
    const missing = await admin.from("class_activities").insert({ class_id: classA, activity_id: randomUUID() });
    expect(missing.error?.code).toBe("23503");
  });

  it("rejects duplicate assignments including concurrent inserts", async () => {
    const input = { class_id: classA, activity_id: activityId };
    const results = await Promise.all([insertClassActivity(teacherA, input), insertClassActivity(teacherA, input)]);
    expect(results.filter((r) => r.data)).toHaveLength(1);
    expect(results.find((r) => r.error)?.error?.code).toBe("23505");
  });

  it("rejects an invalid partial update and leaves saved dates unchanged", async () => {
    const row = await assign(classA, { opens_at: "2026-09-12T10:00:00Z", closes_at: "2026-09-12T11:00:00Z" });
    const result = await updateClassActivity(teacherA, row.id, { opens_at: "2026-09-12T12:00:00Z" });
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect((await getClassActivities(teacherA, classA)).data![0].opens_at).toBe(row.opens_at);
  });

  it("denies other teachers reads, inserts, updates, and ownership moves", async () => {
    const row = await assign();
    expect((await getClassActivities(teacherB, classA)).data).toEqual([]);
    expect((await insertClassActivity(teacherA, { class_id: classB, activity_id: activityId })).error?.code).toBe("42501");
    expect((await updateClassActivity(teacherB, row.id, { closes_at: null })).error?.code).toBe("NOT_FOUND");
    const direct = await teacherB.from("class_activities").update({ opens_at: "2026-09-12T00:00:00Z" }).eq("id", row.id).select("id");
    expect(direct.data ?? []).toEqual([]);
    const move = await teacherA.from("class_activities").update({ class_id: classB }).eq("id", row.id);
    expect(move.error?.code).toBe("42501");
  });

  it("denies anonymous reads and writes", async () => {
    await assign();
    const client = anonymous();
    const read = await client.from("class_activities").select("id");
    expect(read.data ?? []).toEqual([]);
    const write = await client.from("class_activities").insert({ class_id: classB, activity_id: activityId });
    expect(write.error).not.toBeNull();
  });
});

describe("student assignment reader against Supabase", () => {
  it.each([
    [null, null, true],
    ["2026-09-12T12:00:00Z", null, true],
    ["2026-09-12T12:00:00.001Z", null, false],
    [null, "2026-09-12T12:00:00Z", false],
    [null, "2026-09-12T12:00:00.001Z", true],
  ])("enforces opening %s and closing %s", async (opens_at, closes_at, visible) => {
    const own = await assign(classA, { opens_at, closes_at });
    await assign(classB);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-12T12:00:00Z"));
    const result = await getStudentAssignments();
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("Reader failed");
    expect(result.assignments.map((a) => a.id)).toEqual(visible ? [own.id] : []);
  });

  it("rejects missing sessions and mismatched membership", async () => {
    session.value = null;
    expect((await getStudentAssignments()).status).toBe("unauthenticated");
    session.value = { studentId, classId: classB, expiresAt: Date.now() + 10000 };
    expect((await getStudentAssignments()).status).toBe("unauthenticated");
  });

  it("rejects inactive classes", async () => {
    const result = await admin.from("classes").update({ is_active: false }).eq("id", classA);
    if (result.error) throw result.error;
    try {
      expect((await getStudentAssignments()).status).toBe("unauthenticated");
    } finally {
      const restored = await admin.from("classes").update({ is_active: true }).eq("id", classA);
      if (restored.error) throw restored.error;
    }
  });
});
