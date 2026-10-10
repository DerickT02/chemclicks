import "server-only";

import { getStudentSession } from "@/lib/auth/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/db/read-pages";
import type { StudentAssignment } from "@/lib/db/student-assignments";
import type { ProgressStatus } from "@/lib/db/student_progress";
import type { QueueAssignment } from "@/lib/assignments/work-queue";
import { hasActivityContent } from "@/lib/assignments/activity-content";
import { scheduleStatus } from "@/lib/assignments/schedule";

type AssignmentRow = StudentAssignment & { class_id: string };
type ProgressRow = { student_id: string; class_activity_id: string; status: unknown };
export type StudentWorkQueueResult =
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | {
    status: "ok";
    context: { studentName: string; className: string; section: string };
    assignments: QueueAssignment[];
    checkedAt: number;
    progressError: string | null;
  };

const PROGRESS_ERROR = "Exploration progress could not be loaded. Refresh assignments to try again.";
const namePart = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const isProgressStatus = (value: unknown): value is ProgressStatus =>
  value === "not_started" || value === "in_progress" || value === "completed";

/** No caller-supplied identity, cross-request cache, exercise content, or closed-history grant. */
export async function getStudentWorkQueue(): Promise<StudentWorkQueueResult> {
  try {
    const session = await getStudentSession();
    if (!session) return { status: "unauthenticated" };
    const client = createAdminClient();
    const readContext = async () => {
      const { data: student, error: studentError } = await client.from("students")
        .select("id, class_id, first_name, last_name")
        .eq("id", session.studentId).eq("class_id", session.classId).maybeSingle();
      if (studentError) throw studentError;
      if (!student || student.id !== session.studentId || student.class_id !== session.classId) return null;
      const { data: classroom, error: classError } = await client.from("classes")
        .select("id, name, section, is_active")
        .eq("id", session.classId).eq("is_active", true).maybeSingle();
      if (classError) throw classError;
      if (!classroom || classroom.id !== session.classId || classroom.is_active !== true) return null;
      return {
        studentName: [namePart(student.first_name), namePart(student.last_name)].filter(Boolean).join(" ") || "Student",
        className: namePart(classroom.name) || "Your class",
        section: namePart(classroom.section),
      };
    };
    if (!await readContext()) return { status: "unauthenticated" };

    const readMetadata = async () => {
      const metadata = await readAllPages((from, to) => client.from("class_activities")
        .select("id, class_id, opens_at, closes_at, activity:activities!inner(id, title, type, order_index)")
        .eq("class_id", session.classId).order("id").range(from, to).returns<AssignmentRow[]>());
      if (metadata.error || metadata.data === null) throw new Error("Assignments unavailable.");
      return [...new Map(metadata.data.filter(row => row.class_id === session.classId)
        .map(row => [row.id, row])).values()];
    };
    const assignments = await readMetadata();
    const readAt = Date.now();
    const availableIds = assignments.filter(row => scheduleStatus(row, readAt) === "Open"
      && hasActivityContent(row.activity.type)).map(row => row.id);
    const states = new Map<string, ProgressStatus>();
    let progressError: string | null = null;
    // Keep requests bounded, paginate past backend caps, and discard all partial progress on failure.
    for (let index = 0; index < availableIds.length && !progressError; index += 50) {
      const batch = availableIds.slice(index, index + 50);
      const result = await readAllPages((from, to) => {
        const now = new Date().toISOString();
        return client.from("student_progress")
          .select("student_id, class_activity_id, status, assignment:class_activities!inner(class_id, opens_at, closes_at), student:students!inner(class_id)")
          .eq("student_id", session.studentId).eq("student.class_id", session.classId)
          .eq("assignment.class_id", session.classId).in("class_activity_id", batch)
          .or(`opens_at.is.null,opens_at.lte.${now}`, { referencedTable: "assignment" })
          .or(`closes_at.is.null,closes_at.gt.${now}`, { referencedTable: "assignment" })
          .order("id").range(from, to).returns<ProgressRow[]>();
      });
      if (result.error || result.data === null) {
        progressError = PROGRESS_ERROR;
        break;
      }
      for (const row of result.data) {
        if (row.student_id !== session.studentId || !batch.includes(row.class_activity_id)) continue;
        const existing = states.get(row.class_activity_id);
        if (!isProgressStatus(row.status) || (existing !== undefined && existing !== row.status)) {
          progressError = PROGRESS_ERROR;
          break;
        }
        states.set(row.class_activity_id, row.status);
      }
    }
    // Recheck schedules and membership after reads; this is not a transactional snapshot.
    // A changed/newly opened assignment needs a fresh progress read, not a fabricated zero.
    const latestAssignments = availableIds.length ? await readMetadata() : assignments;
    const originals = new Map(assignments.map(row => [row.id, row]));
    const available = new Set(availableIds);
    const context = await readContext();
    if (!context) return { status: "unauthenticated" };
    const checkedAt = Date.now();
    return {
      status: "ok", context, checkedAt, progressError,
      assignments: latestAssignments.map(row => ({
        id: row.id, opens_at: row.opens_at, closes_at: row.closes_at,
        activity: { id: row.activity.id, title: row.activity.title, type: row.activity.type, order_index: row.activity.order_index },
        progress: !progressError && available.has(row.id) && scheduleStatus(row, checkedAt) === "Open"
          && originals.get(row.id)?.opens_at === row.opens_at && originals.get(row.id)?.closes_at === row.closes_at
          ? states.get(row.id) ?? "not_started" : null,
      })),
    };
  } catch {
    return { status: "error", message: "Your assignments could not be loaded. Please try again." };
  }
}
