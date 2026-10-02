import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  results: {} as Record<string, unknown>,
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));
vi.mock("@/lib/auth/student-session", () => ({ getStudentSession: mocks.session }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const builder: Record<string, (...args: unknown[]) => unknown> = {};
      for (const method of ["select", "eq", "is", "or", "order", "range"]) {
        builder[method] = (...args: unknown[]) => {
          mocks.calls.push({ table, method, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => mocks.results[table];
      builder.returns = async () => mocks.results[table];
      return builder;
    },
  }),
}));

import { getStudentAssignments } from "@/lib/db/student-assignments";

const studentId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const HOUR = 60 * 60 * 1000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
const row = (id: string, opens_at: string | null, closes_at: string | null) => ({
  id, opens_at, closes_at,
  activity: { id: `activity-${id}`, title: id, type: "lewis_structures_covalent", order_index: 1 },
});
const callsTo = (table: string, method: string) =>
  mocks.calls.filter((call) => call.table === table && call.method === method);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.session.mockResolvedValue({ studentId, classId });
  mocks.results.students = { data: { id: studentId, class_id: classId }, error: null };
  mocks.results.classes = { data: { id: classId }, error: null };
  mocks.results.class_activities = { data: [], error: null };
});

describe("getStudentAssignments", () => {
  it("scopes assignments to the session student's class and availability window", async () => {
    await getStudentAssignments();
    expect(callsTo("students", "eq")).toEqual(expect.arrayContaining([
      expect.objectContaining({ args: ["id", studentId] }),
      expect.objectContaining({ args: ["class_id", classId] }),
    ]));
    expect(callsTo("classes", "eq")).toEqual(expect.arrayContaining([
      expect.objectContaining({ args: ["is_active", true] }),
    ]));
    expect(callsTo("class_activities", "eq")).toEqual([
      expect.objectContaining({ args: ["class_id", classId] }),
    ]);
    expect(callsTo("class_activities", "is")).toEqual([
      expect.objectContaining({ args: ["archived_at", null] }),
    ]);
    const windowFilters = callsTo("class_activities", "or").map((call) => call.args[0]);
    expect(windowFilters).toEqual([
      expect.stringMatching(/^opens_at\.is\.null,opens_at\.lte\./),
      expect.stringMatching(/^closes_at\.is\.null,closes_at\.gt\./),
    ]);
  });

  it("drops rows outside their window even if the query returns them", async () => {
    mocks.results.class_activities = { data: [
      row("open", null, null),
      row("future", iso(HOUR), null),
      row("closed", null, iso(-HOUR)),
    ], error: null };
    const result = await getStudentAssignments();
    expect(result).toEqual({ status: "ok", assignments: [row("open", null, null)] });
  });

  it("treats missing sessions and inactive classes as unauthenticated", async () => {
    mocks.session.mockResolvedValue(null);
    expect(await getStudentAssignments()).toEqual({ status: "unauthenticated" });
    mocks.session.mockResolvedValue({ studentId, classId });
    mocks.results.classes = { data: null, error: null };
    expect(await getStudentAssignments()).toEqual({ status: "unauthenticated" });
  });
});
