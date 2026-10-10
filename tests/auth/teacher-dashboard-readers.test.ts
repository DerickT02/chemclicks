import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { readAllPages, type ReadError } from "@/lib/db/read-pages";
import { listActiveClassesForTeacher } from "@/lib/db/classes";
import { getClassActivities } from "@/lib/db/class_activities";
import { getTeacherRoster, getClassCurrentProgress } from "@/lib/db/teacher-dashboard";

type Row = { id: string; [key: string]: unknown };
type Call = { table: string; method: string; args: unknown[] };
const classId = "11111111-1111-4111-8111-111111111111";
const privateError = { code: "42501", message: "private database details" };

function clientFor(tables: Record<string, Row[]>, fail?: { table: string; from: number }) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let start = 0;
    let end = 99;
    const field = (row: Row, column: string): unknown => column.split(".").reduce<unknown>((value, key) =>
      value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, row);
    const query = {
      select: (columns: string) => { calls.push({ table, method: "select", args: [columns] }); return query; },
      order: (column: string, options?: unknown) => { calls.push({ table, method: "order", args: [column, options] }); return query; },
      in: (column: string, values: unknown[]) => {
        calls.push({ table, method: "in", args: [column, values] });
        filters.push(row => values.includes(field(row, column)));
        return query;
      },
      eq: (column: string, value: unknown) => {
        calls.push({ table, method: "eq", args: [column, value] });
        filters.push(row => field(row, column) === value);
        return query;
      },
      range: (a: number, b: number) => { start = a; end = b; calls.push({ table, method: "range", args: [a, b] }); return query; },
      returns: async () => {
        if (fail?.table === table && start >= fail.from) return { data: null, error: privateError };
        return { data: (tables[table] ?? []).filter(row => filters.every(filter => filter(row))).slice(start, end + 1), error: null };
      },
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, from, calls };
}

const student = (id: string, class_id = classId, last_name = "Student") => ({ id, class_id, first_name: id, last_name });
const progress = (id: string, assignmentClass = classId, studentClass = classId) => ({
  id, student_id: id, class_activity_id: "assignment", status: "completed",
  assignment: { class_id: assignmentClass }, student: { class_id: studentClass },
});

describe("paged dashboard reads", () => {
  it("follows actual rows returned even when the backend cap is below the requested page size", async () => {
    const rows = [1, 2, 3, 4, 5];
    const fetchPage = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + 2)), error: null }));
    expect(await readAllPages(fetchPage)).toEqual({ data: rows, error: null });
    expect(fetchPage.mock.calls).toEqual([[0, 99], [2, 101], [4, 103], [5, 104]]);
  });
  it.each(["classes", "students", "class_activities", "student_progress"])("reads more than 1000 %s rows without truncation", async table => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      ...student(`row-${index}`), teacher_id: "teacher", is_active: true,
      ...progress(`row-${index}`),
    }));
    const mock = clientFor({ [table]: rows });
    const result = table === "classes" ? await listActiveClassesForTeacher(mock.client, "teacher")
      : table === "students" ? await getTeacherRoster(mock.client, [classId])
      : table === "class_activities" ? await getClassActivities(mock.client, classId)
      : await getClassCurrentProgress(mock.client, classId);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1001);
    expect(mock.calls.filter(call => call.method === "range").map(call => call.args)).toContainEqual([1000, 1099]);
  });
  it.each(["classes", "students", "class_activities", "student_progress"])("discards partial %s data when a later page fails", async table => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...student(`row-${index}`), teacher_id: "teacher", is_active: true,
      ...progress(`row-${index}`),
    }));
    const mock = clientFor({ [table]: rows }, { table, from: 100 });
    const result = table === "classes" ? await listActiveClassesForTeacher(mock.client, "teacher")
      : table === "students" ? await getTeacherRoster(mock.client, [classId])
      : table === "class_activities" ? await getClassActivities(mock.client, classId)
      : await getClassCurrentProgress(mock.client, classId);
    expect(result).toEqual({ data: null, error: privateError });
  });
  it.each(["null data", "exception"])("does not turn %s into an empty list", async mode => {
    const result = await readAllPages<number>(async () => {
      if (mode === "exception") throw new Error("private transport details");
      return { data: null, error: null };
    });
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("READ_FAILED");
    expect(result.error?.message).not.toContain("private");
  });
});

describe("dashboard query scope", () => {
  it("does not query students without owned active classes", async () => {
    const mock = clientFor({ students: [student("foreign", "foreign")] });
    expect(await getTeacherRoster(mock.client, [])).toEqual({ data: [], error: null });
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("batches owned class IDs and retains deterministic alphabetical enrollment ordering", async () => {
    const ids = Array.from({ length: 51 }, (_, index) => `class-${index}`);
    const mock = clientFor({ students: [student("z", ids[0], "Zebra"), student("a", ids[50], "Alpha"), student("foreign", "foreign")] });
    const result = await getTeacherRoster(mock.client, [...ids, ids[0]]);
    expect(result.data?.map(row => row.id)).toEqual(["a", "z"]);
    const batches = mock.calls.filter(call => call.method === "in").map(call => call.args[1] as string[]);
    expect(batches.every(batch => batch.length <= 50)).toBe(true);
    expect(batches).toContainEqual(ids.slice(0, 50));
    expect(batches).toContainEqual([ids[50]]);
    expect(mock.calls.filter(call => call.method === "order").every(call => call.args[0] === "id")).toBe(true);
  });
  it("discards completed earlier batches on a later batch failure", async () => {
    const ids = Array.from({ length: 51 }, (_, index) => `class-${index}`);
    const error: ReadError = privateError;
    let batch = 0;
    const result = await getTeacherRoster({ from: () => {
      const query = {
        select: () => query, order: () => query, range: () => query,
        in: () => { batch++; return query; },
        returns: async () => batch === 1 ? { data: [student("one", ids[0])], error: null }
          : batch === 2 ? { data: [], error: null } : { data: null, error },
      };
      return query;
    } } as unknown as SupabaseClient, ids);
    expect(result).toEqual({ data: null, error });
  });
  it("limits progress to the selected class on both the student and assignment relationships", async () => {
    const mock = clientFor({ student_progress: [
      progress("owned"), progress("foreign-student", classId, "foreign"),
      progress("foreign-assignment", "foreign", classId), progress("foreign-both", "foreign", "foreign"),
    ] });
    const result = await getClassCurrentProgress(mock.client, classId);
    expect(result.data?.map(row => row.student_id)).toEqual(["owned"]);
    expect(mock.calls.filter(call => call.method === "eq").map(call => call.args))
      .toEqual([["assignment.class_id", classId], ["student.class_id", classId], ["assignment.class_id", classId], ["student.class_id", classId]]);
    expect(mock.calls.find(call => call.method === "select")?.args[0]).toContain("!inner");
    expect(mock.calls.filter(call => call.method === "order").every(call => call.args[0] === "id")).toBe(true);
  });
  it("retains active ownership filters while paging classroom metadata", async () => {
    const mock = clientFor({ classes: [
      { id: "owned", teacher_id: "teacher", is_active: true },
      { id: "disabled", teacher_id: "teacher", is_active: false },
      { id: "foreign", teacher_id: "other", is_active: true },
    ] });
    expect((await listActiveClassesForTeacher(mock.client, "teacher")).data?.map(row => row.id)).toEqual(["owned"]);
  });
  it("does not query assignment metadata for invalid class IDs", async () => {
    const mock = clientFor({});
    expect((await getClassActivities(mock.client, "invalid")).error?.code).toBe("VALIDATION_ERROR");
    expect(mock.from).not.toHaveBeenCalled();
  });
});
