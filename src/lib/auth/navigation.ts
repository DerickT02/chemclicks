"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type NavigationIdentity =
  | { status: "signed-out" }
  | { status: "signed-in"; role: "student" | "teacher" | null; message?: string }
  | { status: "error" };

const DASHBOARD_ERROR = "Your dashboard could not be loaded. Please try again.";

/** Read-only navigation hint, not an authorization gate. Never accept a user ID or role from the browser. */
export async function getNavigationIdentity(): Promise<NavigationIdentity> {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") return { status: "error" };
    if (!user) return { status: "signed-out" };
    if (user.is_anonymous) return { status: "signed-in", role: null };

    try {
      // Student linking takes precedence even if a legacy signup trigger also
      // created a teacher profile. Client-editable metadata is never a role source.
      const admin = createAdminClient();
      const { data: student, error: studentError } = await admin
        .from("students").select("id, class_id, verified").eq("auth_user_id", user.id).maybeSingle();
      if (studentError) throw studentError;
      if (student) {
        if (student.verified !== true) {
          return { status: "signed-in", role: null, message: "Your account is awaiting teacher approval. Please contact your teacher." };
        }
        const { data: classroom, error: classError } = await admin
          .from("classes").select("id").eq("id", student.class_id).eq("is_active", true).maybeSingle();
        if (classError) throw classError;
        // An ineligible student must not fall through to a legacy teacher profile.
        return classroom
          ? { status: "signed-in", role: "student" }
          : { status: "signed-in", role: null, message: "Your classroom is inactive or unavailable. Please contact your teacher." };
      }

      if (!user.email_confirmed_at) return { status: "signed-in", role: null };
      const { data: teacher, error: teacherError } = await client
        .from("teachers").select("id").eq("id", user.id).maybeSingle();
      if (teacherError) throw teacherError;
      return { status: "signed-in", role: teacher ? "teacher" : null };
    } catch {
      return { status: "signed-in", role: null, message: DASHBOARD_ERROR };
    }
  } catch {
    return { status: "error" };
  }
}
