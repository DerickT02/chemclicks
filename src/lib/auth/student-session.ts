import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type StudentSession = { studentId: string; classId: string };

/** Verify the Supabase cookie, then resolve its user to an existing student. */
export async function getStudentSession(): Promise<StudentSession | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const authUserId = data?.claims?.sub;
    if (error || !authUserId) return null;

    // Student table RLS is still teacher-only; continue to authorize all
    // student data on the server, exactly as before this session migration.
    const admin = createAdminClient();
    const { data: student, error: studentError } = await admin.from("students")
      .select("id, class_id, verified")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    // Recheck approval on every request, including sessions issued before this gate.
    if (studentError || !student || student.verified !== true) return null;

    const { data: classroom, error: classError } = await admin.from("classes")
      .select("id")
      .eq("id", student.class_id)
      .eq("is_active", true)
      .maybeSingle();
    if (classError || !classroom) return null;

    return { studentId: student.id, classId: classroom.id };
  } catch {
    return null;
  }
}
