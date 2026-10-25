import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ACTIVITY_REGISTRY, canAssignActivity } from "@/lib/activities/registry";
import type { ActivityType } from "@/lib/db/activities";

const mocks = vi.hoisted(() => ({
  type: "lewis_diagram", insert: vi.fn(), assignments: vi.fn(), attempts: vi.fn(), session: vi.fn(), rpc: vi.fn(), refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("next/navigation", () => ({
  redirect: () => { throw new Error("Unexpected redirect"); },
  notFound: () => { throw new Error("Unexpected not-found"); },
}));
vi.mock("@/lib/server/teacher", () => ({ requireTeacherId: async () => "teacher" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "teacher" } }, error: null }) },
  from: (table: string) => {
    const chain = { select: () => chain, eq: () => chain,
      maybeSingle: async () => ({ data: { id: table === "classes" ? classId : activityId, type: mocks.type }, error: null }),
    };
    return chain;
  },
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/db/class_activities", () => ({ insertClassActivity: mocks.insert }));
vi.mock("@/lib/db/student-assignments", () => ({ getStudentAssignments: mocks.assignments, getStudentAssignmentSchedules: mocks.assignments }));
vi.mock("@/lib/server/student-assignments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/student-assignments")>()),
  getAssignmentAttempts: mocks.attempts,
}));
vi.mock("@/lib/auth/student-session", () => ({ getStudentSession: mocks.session }));
vi.mock("@/lib/server/database", () => ({ createServiceClient: () => ({
  rpc: mocks.rpc,
  from: () => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null, error: null }) };
    return chain;
  },
}) }));
vi.mock("@/components/assignments/AssignmentAccess", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/bohr-models/BohrModelViewer", () => ({ default: () => <p>Explorer: bohr</p> }));
vi.mock("@/components/lewis/LewisDotExplorer", () => ({ default: () => <p>Explorer: lewis-diagram</p> }));
vi.mock("@/components/lewis/CovalentBondExplorer", () => ({ default: () => <p>Explorer: covalent</p> }));
vi.mock("@/components/lewis/IonicCompoundExplorer", () => ({ default: () => <p>Explorer: ionic</p> }));
vi.mock("@/components/measurement/GraduatedCylinder", () => ({ default: () => <p>Explorer: cylinder</p> }));
vi.mock("@/components/measurement/PrecisionRuler", () => ({ default: () => <p>Explorer: ruler</p> }));

import { saveAssignment } from "@/app/admin/assignments/actions";
import AssignmentPage from "@/app/(student)/student/assignments/[assignmentId]/page";
import { saveAttempt } from "@/app/(student)/student/assignments/[assignmentId]/actions";

const classId = "11111111-1111-4111-8111-111111111111";
const activityId = "22222222-2222-4222-8222-222222222222";
const assignmentId = "33333333-3333-4333-8333-333333333333";
const attemptId = "44444444-4444-4444-8444-444444444444";
const session = { studentId: "55555555-5555-4555-8555-555555555555", classId };
const enabled = Object.entries(ACTIVITY_REGISTRY).filter(([type]) => canAssignActivity(type));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ data: { id: assignmentId }, error: null });
  mocks.session.mockResolvedValue(session);
  mocks.assignments.mockResolvedValue({ status: "ok", assignments: [] });
  mocks.attempts.mockResolvedValue([]);
  mocks.rpc.mockImplementation(async (_name: string, input: { p_action: string }) => ({
    data: [{ id: attemptId, status: input.p_action === "complete" ? "completed" : "in_progress", score: null, passed: null }], error: null,
  }));
});

describe("mocked assign → open → finish contract (not a live deployment check)", () => {
  it.each(enabled)("supports %s without saving quiz results", async (type, definition) => {
    mocks.type = type;
    const assignmentForm = new FormData();
    assignmentForm.set("class_id", classId);
    assignmentForm.set("activity_id", activityId);
    expect((await saveAssignment({ status: "idle", message: "" }, assignmentForm)).status).toBe("success");
    expect(mocks.insert).toHaveBeenCalledWith(expect.anything(), {
      class_id: classId, activity_id: activityId, opens_at: null, closes_at: null,
    });

    mocks.assignments.mockResolvedValue({ status: "ok", assignments: [{
      id: assignmentId, opens_at: null, closes_at: null,
      activity: { id: activityId, title: "Assigned activity", type: type as ActivityType, order_index: 1 },
    }] });
    mocks.attempts.mockResolvedValue([{
      id: "exploration", attempt_number: 1, quiz_key: null, status: "in_progress",
      started_at: "2026-10-24T10:00:00Z", completed_at: null,
    }]);
    const html = renderToStaticMarkup(await AssignmentPage({ params: Promise.resolve({ assignmentId }) }));
    expect(html).toContain(`Explorer: ${definition.explorer}`);
    expect(html).toContain("Saved exploration history");
    expect(html).not.toContain("exercise is not available yet");

    const attemptForm = new FormData();
    attemptForm.set("assignmentId", assignmentId);
    attemptForm.set("action", "start");
    expect(await saveAttempt({ error: null }, attemptForm)).toEqual({ error: null });
    attemptForm.set("action", "complete");
    attemptForm.set("attemptId", attemptId);
    // Browser-supplied grades must never enter the exploration RPC.
    attemptForm.set("score", "100");
    expect(await saveAttempt({ error: null }, attemptForm)).toEqual({ error: null });
    expect(mocks.rpc).toHaveBeenLastCalledWith("student_attempt_transition", {
      p_student_id: session.studentId, p_class_id: classId, p_assignment_id: assignmentId,
      p_action: "complete", p_attempt_id: attemptId,
    });
    expect(mocks.refresh).toHaveBeenCalledWith("/student");
  });
});
