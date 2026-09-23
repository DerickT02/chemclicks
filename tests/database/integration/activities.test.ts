import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Activity } from "@/lib/db/activities";

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

let teacher: SupabaseClient;
let student: SupabaseClient;
let teacherUserId: string;
let studentUserId: string;
let classId: string;
let studentId: string;
let classActivityId: string | undefined;
let activity: Activity;

async function createAuthClient(label: string): Promise<{
  client: SupabaseClient;
  userId: string;
}> {
  const email = `activities-${label}-${randomUUID()}@example.com`;
  const password = `T!${randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;

  const client = anonymous();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  return { client, userId: created.data.user.id };
}

beforeAll(async () => {
  const catalog = await admin
    .from("activities")
    .select("id, title, type, order_index")
    .order("order_index")
    .limit(1)
    .single<Activity>();
  if (catalog.error) {
    throw new Error(
      `Activities RLS tests require one existing catalog activity. ${catalog.error.message}`,
    );
  }
  activity = catalog.data;

  const teacherAuth = await createAuthClient("teacher");
  teacher = teacherAuth.client;
  teacherUserId = teacherAuth.userId;
  const teacherRow = await admin.from("teachers").upsert({
    id: teacherUserId,
    email: `teacher-${teacherUserId}@example.com`,
    display_name: "Activity catalog teacher",
  });
  if (teacherRow.error) throw teacherRow.error;

  const classroom = await admin
    .from("classes")
    .insert({
      teacher_id: teacherUserId,
      name: "Activity RLS test",
      section: "Test",
      class_code: randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase(),
    })
    .select("id")
    .single();
  if (classroom.error) throw classroom.error;
  classId = classroom.data.id;

  const studentAuth = await createAuthClient("student");
  student = studentAuth.client;
  studentUserId = studentAuth.userId;
  const studentRow = await admin
    .from("students")
    .insert({
      auth_user_id: studentUserId,
      class_id: classId,
      first_name: "Activity",
      last_name: "Student",
      student_id: `test-${randomUUID()}`,
    })
    .select("id")
    .single();
  if (studentRow.error) throw studentRow.error;
  studentId = studentRow.data.id;
}, 60_000);

afterAll(async () => {
  const errors: string[] = [];
  if (classActivityId) {
    const result = await admin
      .from("class_activities")
      .delete()
      .eq("id", classActivityId);
    if (result.error) errors.push(result.error.message);
  }
  if (studentId) {
    const result = await admin.from("students").delete().eq("id", studentId);
    if (result.error) errors.push(result.error.message);
  }
  if (classId) {
    const result = await admin.from("classes").delete().eq("id", classId);
    if (result.error) errors.push(result.error.message);
  }
  for (const id of [studentUserId, teacherUserId].filter(Boolean)) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) errors.push(result.error.message);
  }
  if (errors.length) {
    throw new Error(`Fixture cleanup failed: ${errors.join("; ")}`);
  }
}, 60_000);

describe("activities catalog RLS", () => {
  it("denies anonymous reads and writes", async () => {
    const client = anonymous();
    const read = await client.from("activities").select("id");
    expect(read.error).not.toBeNull();
    expect(read.data).toBeNull();

    const write = await client.from("activities").insert({
      title: "Unauthorized activity",
      type: activity.type,
      order_index: activity.order_index,
    });
    expect(write.error).not.toBeNull();
  });

  it.each([
    ["teacher", () => teacher],
    ["student", () => student],
  ])("allows an authenticated %s to read catalog metadata", async (_, getClient) => {
    const result = await getClient()
      .from("activities")
      .select("id, title, type, order_index")
      .eq("id", activity.id)
      .single<Activity>();

    expect(result.error).toBeNull();
    expect(result.data).toEqual(activity);
  });

  it.each([
    ["teacher", () => teacher],
    ["student", () => student],
  ])("denies catalog mutations from an authenticated %s", async (_, getClient) => {
    const client = getClient();
    const inserted = await client.from("activities").insert({
      title: "Unauthorized activity",
      type: activity.type,
      order_index: activity.order_index,
    });
    const updated = await client
      .from("activities")
      .update({ title: "Unauthorized update" })
      .eq("id", activity.id);
    const deleted = await client
      .from("activities")
      .delete()
      .eq("id", activity.id);

    expect(inserted.error).not.toBeNull();
    expect(updated.error).not.toBeNull();
    expect(deleted.error).not.toBeNull();

    const unchanged = await admin
      .from("activities")
      .select("title")
      .eq("id", activity.id)
      .single();
    expect(unchanged.data?.title).toBe(activity.title);
  });

  it("does not weaken the existing class activity policies", async () => {
    const inserted = await teacher
      .from("class_activities")
      .insert({ class_id: classId, activity_id: activity.id })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();
    classActivityId = inserted.data?.id;

    const teacherRead = await teacher
      .from("class_activities")
      .select("id")
      .eq("id", classActivityId)
      .single();
    expect(teacherRead.error).toBeNull();

    const studentRead = await student
      .from("class_activities")
      .select("id")
      .eq("id", classActivityId);
    expect(studentRead.data).toEqual([]);
  });
});
