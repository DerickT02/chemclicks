import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import * as classes from "@/lib/db/classes";

function clientFor(result: { data: unknown; error: unknown }) {
  const from = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const order = vi.fn();
  const range = vi.fn();
  const returns = vi.fn().mockResolvedValueOnce(result).mockResolvedValue({ data: [], error: null });
  const query = { select, eq, order, range, returns };
  from.mockReturnValue(query);
  select.mockReturnValue(query);
  eq.mockReturnValue(query);
  order.mockReturnValue(query);
  range.mockReturnValue(query);
  return { client: { from } as unknown as SupabaseClient, from, select, eq, order, range };
}

describe("active classroom listing", () => {
  it("scopes the list to owned active classes with stable newest-first ordering", async () => {
    const data = [{ id: "class", name: "Chemistry", section: "A", class_code: "ABC123" }];
    const mock = clientFor({ data, error: null });
    expect(await classes.listActiveClassesForTeacher(mock.client, "teacher")).toEqual({ data, error: null });
    expect(mock.from).toHaveBeenCalledWith("classes");
    expect(mock.select).toHaveBeenCalledWith("id, name, section, class_code");
    expect(mock.eq.mock.calls).toEqual([["teacher_id", "teacher"], ["is_active", true], ["teacher_id", "teacher"], ["is_active", true]]);
    expect(mock.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mock.order).toHaveBeenCalledWith("id");
    expect(mock.range.mock.calls).toEqual([[0, 99], [1, 100]]);
  });
  it("preserves a confirmed empty active-class list", async () => {
    const mock = clientFor({ data: [], error: null });
    expect(await classes.listActiveClassesForTeacher(mock.client, "teacher")).toEqual({ data: [], error: null });
  });
  it("does not turn a failed list read into an empty dashboard", async () => {
    const error = { code: "QUERY_ERROR", message: "unavailable" };
    const mock = clientFor({ data: [], error });
    expect(await classes.listActiveClassesForTeacher(mock.client, "teacher")).toEqual({ data: null, error });
  });
  it("does not expose a permanent-class-deletion helper", () => {
    expect(classes).not.toHaveProperty("deleteClass");
  });
});
