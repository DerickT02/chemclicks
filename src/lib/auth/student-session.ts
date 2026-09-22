import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StudentSession = {
  authUserId: string;
  studentId: string;
  classId: string;
};

/** Resolve the verified Supabase Auth user to their student application row. */
export async function getStudentSession(): Promise<StudentSession | null> {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const authUserId = claimsData?.claims?.sub;

    if (claimsError || typeof authUserId !== "string") return null;

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, class_id")
      .eq("id", authUserId)
      .maybeSingle();

    if (studentError || !student) return null;

    // The student classes policy exposes this row only while the classroom is
    // active, preserving the previous inactive-class login behavior.
    const { data: classroom, error: classError } = await supabase
      .from("classes")
      .select("id")
      .eq("id", student.class_id)
      .maybeSingle();

    if (classError || !classroom) return null;

    return {
      authUserId,
      studentId: student.id,
      classId: classroom.id,
    };
  } catch {
    return null;
  }
}
