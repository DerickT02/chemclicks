import "server-only";
import { createServiceClient } from "@/lib/server/database";
import { requireTeacherId } from "@/lib/server/teacher";
import type { TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function isClassUpdateCursor(value: string): boolean {
  return /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= BigInt("9223372036854775807");
}

export async function getTeacherClassUpdates(classId: string, options: {
  after?: string;
  assignmentId?: string;
} = {}): Promise<TeacherClassSnapshot> {
  const teacherId = await requireTeacherId();
  if (!UUID.test(classId) || (options.assignmentId !== undefined && !UUID.test(options.assignmentId))
    || (options.after !== undefined && !isClassUpdateCursor(options.after))) throw new Error("Invalid class update request.");
  // One verification, one RPC. The RPC independently checks ownership and reads
  // the revision, membership and requested rows in one database snapshot.
  const { data, error } = await createServiceClient().rpc("teacher_class_updates", {
    p_teacher_id: teacherId, p_class_id: classId,
    p_after: options.after ?? null, p_assignment_id: options.assignmentId ?? null,
  });
  if (error || !data) throw new Error("Class updates access denied or unavailable.");
  return data as TeacherClassSnapshot;
}
