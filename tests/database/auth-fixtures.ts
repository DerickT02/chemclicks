import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Create a disposable Auth identity whose UUID can be used as public.students.id. */
export async function createTestStudentAuthUser(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `student-test-${randomUUID()}@example.com`,
    email_confirm: true,
    app_metadata: { account_type: "student", test_fixture: true },
  });
  if (error) throw error;
  return data.user.id;
}

export async function deleteTestAuthUsers(
  admin: SupabaseClient,
  userIds: string[],
): Promise<void> {
  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && !error.message.toLowerCase().includes("not found")) throw error;
  }
}
