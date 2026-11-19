import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path) {
  const values = {};
  let text;

  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Could not read ${path}. Generate it with supabase status first.`);
  }

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = { ...readEnvFile(".env.local"), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local.",
  );
}

if (!/^https?:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) {
  throw new Error(`Refusing to seed a non-local Supabase URL: ${url}`);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const teachers = [
  {
    email: "teacher.one@chemclicks.local",
    password: "ChemClicksLocal1!",
    displayName: "Alex Morgan",
    classId: "10000000-0000-0000-0000-000000000001",
    classCode: "CHEM01",
    className: "General Chemistry I",
    section: "A",
    studentId: "20000000-0000-0000-0000-000000000001",
    studentCode: "STUDENT01",
    firstName: "Jordan",
    lastName: "Lee",
    assignmentId: "30000000-0000-0000-0000-000000000001",
    assignActivities: true,
  },
  {
    email: "teacher.two@chemclicks.local",
    password: "ChemClicksLocal2!",
    displayName: "Taylor Rivera",
    classId: "10000000-0000-0000-0000-000000000002",
    classCode: "CHEM02",
    className: "General Chemistry II",
    section: "B",
    studentId: "20000000-0000-0000-0000-000000000002",
    studentCode: "STUDENT02",
    firstName: "Casey",
    lastName: "Patel",
    assignmentId: "30000000-0000-0000-0000-000000000002",
    assignActivities: false,
  },
];

const { data: existingUsers, error: listUsersError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listUsersError) throw new Error(`Loading local Auth users failed: ${listUsersError.message}`);

for (const fixture of teachers) {
  const existingUser = existingUsers.users.find((user) => user.email === fixture.email);
  let teacherId = existingUser?.id;

  if (existingUser) {
    const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
      password: fixture.password,
      email_confirm: true,
      user_metadata: { display_name: fixture.displayName },
    });
    if (updateError) throw new Error(`Updating ${fixture.email} failed: ${updateError.message}`);
  } else {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      user_metadata: { display_name: fixture.displayName },
    });
    if (authError) throw new Error(`Creating ${fixture.email} failed: ${authError.message}`);
    teacherId = authData.user?.id;
  }

  if (!teacherId) throw new Error(`Supabase did not return an ID for ${fixture.email}.`);

  const { error: teacherError } = await admin.from("teachers").upsert(
    {
      id: teacherId,
      email: fixture.email,
      display_name: fixture.displayName,
    },
    { onConflict: "id" },
  );
  if (teacherError) throw new Error(`Creating ${fixture.displayName} failed: ${teacherError.message}`);

  const { error: classError } = await admin.from("classes").upsert(
    {
      id: fixture.classId,
      teacher_id: teacherId,
      name: fixture.className,
      section: fixture.section,
      class_code: fixture.classCode,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (classError) throw new Error(`Creating ${fixture.className} failed: ${classError.message}`);

  const { error: studentError } = await admin.from("students").upsert(
    {
      id: fixture.studentId,
      class_id: fixture.classId,
      first_name: fixture.firstName,
      last_name: fixture.lastName,
      student_id: fixture.studentCode,
      verified: true,
    },
    { onConflict: "id" },
  );
  if (studentError) throw new Error(`Creating ${fixture.studentCode} failed: ${studentError.message}`);

  if (fixture.assignActivities) {
    const { data: activities, error: activityError } = await admin
      .from("activities")
      .select("id, type")
      .in("type", ["bohr_model_intro", "lewis_diagram"])
      .order("order_index");
    if (activityError || !activities?.length) {
      throw new Error(`Loading seed activities failed: ${activityError?.message ?? "none found"}`);
    }

    const assignments = activities.slice(0, 2).map((activity, index) => ({
      id: index === 0 ? fixture.assignmentId : `${fixture.assignmentId.slice(0, -1)}${index + 1}`,
      class_id: fixture.classId,
      activity_id: activity.id,
      passing_threshold: 70,
    }));

    const { error: assignmentError } = await admin
      .from("class_activities")
      .upsert(assignments, { onConflict: "id" });
    if (assignmentError) {
      throw new Error(`Creating assignments for ${fixture.classCode} failed: ${assignmentError.message}`);
    }
  }

  console.log(`Seeded ${fixture.email}, ${fixture.classCode}, ${fixture.studentCode}.`);
}

console.log("\nLocal teacher accounts:");
for (const fixture of teachers) {
  console.log(`  ${fixture.email} / ${fixture.password}`);
}
console.log("\nLocal student accounts:");
for (const fixture of teachers) {
  console.log(`  Student ID: ${fixture.studentCode} / Class code: ${fixture.classCode}`);
}
