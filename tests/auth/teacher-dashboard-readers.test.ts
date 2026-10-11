import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { listActiveClassesForTeacher } from "@/lib/db/classes";
import { getClassActivities } from "@/lib/db/class_activities";
import { getTeacherRoster, getClassCurrentProgress } from "@/lib/db/teacher-dashboard";

type Call = { method: string; args: unknown[] };
const classId = "11111111-1111-4111-8111-111111111111";
const privateError = { code: "42501", message: "private database details" };

function clientFor(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    query[method] = (...args: unknown[]) => { calls.push({ method, args }); return query; };
  }
  query.returns = async () => result;
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, from, calls };
}
const callsTo = (calls: Call[], method: string) => calls.filter(call => call.method === method).map(call => call.args);

describe("dashboard reads", () => {
  it("returns the roster in one query ordered by last name, first name, then id", async () => {
    const data = [{ id: "a", class_id: classId, first_name: "A", last_name: "Alpha" }];
    const mock = clientFor({ data, error: null });
    expect(await getTeacherRoster(mock.client, [classId, "other-class", classId])).toEqual({ data, error: null });
    expect(mock.from).toHaveBeenCalledTimes(1);
    expect(mock.from).toHaveBeenCalledWith("students");
    expect(callsTo(mock.calls, "in")).toEqual([["class_id", [classId, "other-class"]]]);
    expect(callsTo(mock.calls, "order")).toEqual([["last_name"], ["first_name"], ["id"]]);
  });
  it("does not query students without owned active classes", async () => {
    const mock = clientFor({ data: [], error: null });
    expect(await getTeacherRoster(mock.client, [])).toEqual({ data: [], error: null });
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("limits progress to the selected class on both the student and assignment relationships", async () => {
    const data = [{ student_id: "owned", class_activity_id: "assignment", status: "completed" }];
    const mock = clientFor({ data, error: null });
    expect(await getClassCurrentProgress(mock.client, classId)).toEqual({ data, error: null });
    expect(mock.from).toHaveBeenCalledTimes(1);
    expect(callsTo(mock.calls, "eq")).toEqual([["assignment.class_id", classId], ["student.class_id", classId]]);
    expect(String(callsTo(mock.calls, "select")[0][0])).toContain("!inner");
  });
  it("scopes class assignments to the selected class", async () => {
    const mock = clientFor({ data: [], error: null });
    expect(await getClassActivities(mock.client, classId)).toEqual({ data: [], error: null });
    expect(mock.from).toHaveBeenCalledWith("class_activities");
    expect(callsTo(mock.calls, "eq")).toEqual([["class_id", classId]]);
  });
  it("does not query assignment metadata for invalid class IDs", async () => {
    const mock = clientFor({ data: [], error: null });
    expect((await getClassActivities(mock.client, "invalid")).error?.code).toBe("VALIDATION_ERROR");
    expect(mock.from).not.toHaveBeenCalled();
  });
  it.each([
    ["roster", (client: SupabaseClient) => getTeacherRoster(client, [classId])],
    ["progress", (client: SupabaseClient) => getClassCurrentProgress(client, classId)],
    ["assignments", (client: SupabaseClient) => getClassActivities(client, classId)],
    ["classes", (client: SupabaseClient) => listActiveClassesForTeacher(client, "teacher")],
  ])("passes through a failed %s read instead of an empty list", async (_name, read) => {
    expect(await read(clientFor({ data: null, error: privateError }).client)).toEqual({ data: null, error: privateError });
  });
});
