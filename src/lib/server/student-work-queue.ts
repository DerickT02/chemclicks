import "server-only";

import { getStudentSession } from "@/lib/auth/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { readStudentAssignmentProgressStates } from "@/lib/server/student-assignment-progress";
import type { StudentAssignment } from "@/lib/db/student-assignments";
import type { ProgressStatus } from "@/lib/db/student_progress";
import type { QueueAssignment } from "@/lib/assignments/work-queue";
import { hasActivityContent } from "@/lib/assignments/activity-content";
import { scheduleStatus } from "@/lib/assignments/schedule";

type AssignmentRow = StudentAssignment & { class_id: string };
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

const PROGRESS_ERROR = "Assignment progress could not be loaded. Refresh the page to try again.";
const namePart = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const isProgressStatus = (value: unknown): value is ProgressStatus =>
  value === "not_started" || value === "in_progress" || value === "completed";

/** No caller-supplied identity, cross-request cache, exercise content, or closed-history grant. */
export async function getStudentWorkQueue(): Promise<StudentWorkQueueResult> {
  try {
    const session = await getStudentSession();
    if (!session) return { status: "unauthenticated" };
    const client = createAdminClient();

    const { data: student, error: studentError } = await client.from("students")
      .select("id, class_id, first_name, last_name")
      .eq("id", session.studentId).eq("class_id", session.classId).maybeSingle();
    if (studentError) throw studentError;
    if (!student) return { status: "unauthenticated" };
    const { data: classroom, error: classError } = await client.from("classes")
      .select("id, name, section, is_active")
      .eq("id", session.classId).eq("is_active", true).maybeSingle();
    if (classError) throw classError;
    if (!classroom) return { status: "unauthenticated" };
    const context = {
      studentName: [namePart(student.first_name), namePart(student.last_name)].filter(Boolean).join(" ") || "Student",
      className: namePart(classroom.name) || "Your class",
      section: namePart(classroom.section),
    };

    const { data: assignments, error: assignmentError } = await client.from("class_activities")
      .select("id, class_id, opens_at, closes_at, activity:activities!inner(id, title, type, order_index)")
      .eq("class_id", session.classId).is("archived_at", null).order("id").returns<AssignmentRow[]>();
    if (assignmentError || !assignments) throw new Error("Assignments unavailable.");

    const checkedAt = Date.now();
    const trackedIds = assignments.filter(row => scheduleStatus(row, checkedAt) === "Open"
      && hasActivityContent(row.activity.type)).map(row => row.id);
    const states = new Map<string, ProgressStatus | null>();
    const explorationCompleted = new Map<string, boolean>();
    const passingQuizKey = new Map<string, string | null>();
    const stages = new Map<string, string>();
    let progressError: string | null = null;
    if (trackedIds.length > 0) {
      try {
        const rows = await readStudentAssignmentProgressStates(session.studentId, session.classId, trackedIds);
        for (const [assignmentId, state] of rows) {
          states.set(assignmentId, isProgressStatus(state.status) ? state.status : null);
          explorationCompleted.set(assignmentId, state.explorationCompleted);
          passingQuizKey.set(assignmentId, state.passingQuizKey);
          stages.set(assignmentId, state.stage);
        }
      } catch {
        progressError = PROGRESS_ERROR;
      }
    }
    const tracked = new Set(trackedIds);
    return {
      status: "ok", context, checkedAt, progressError,
      assignments: assignments.map(row => ({
        id: row.id, opens_at: row.opens_at, closes_at: row.closes_at,
        activity: { id: row.activity.id, title: row.activity.title, type: row.activity.type, order_index: row.activity.order_index },
        progress: progressError || !tracked.has(row.id) ? null : states.has(row.id) ? states.get(row.id) ?? null : "not_started",
        explorationCompleted: progressError || !tracked.has(row.id) ? null : explorationCompleted.get(row.id) ?? false,
        passingQuizKey: progressError || !tracked.has(row.id) ? null : passingQuizKey.get(row.id) ?? null,
        stage: progressError || !tracked.has(row.id) ? null : stages.get(row.id) ?? null,
      })),
    };
  } catch {
    return { status: "error", message: "Your assignments could not be loaded. Please try again." };
  }
}
