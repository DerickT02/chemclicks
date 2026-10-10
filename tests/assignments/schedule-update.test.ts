import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { updateClassActivity } from "@/lib/db/class_activities";
const id = "11111111-1111-4111-8111-111111111111";
const expected = { class_id: "class", activity_id: "activity", opens_at: null, closes_at: "2026-09-12T13:00:00Z" };
const patch = { closes_at: "2026-09-12T14:00:00Z" };
function clientFor(current: unknown, result: unknown = { ...expected, ...patch, id }) {
  const eq = vi.fn(), is = vi.fn(), update = vi.fn(), select = vi.fn();
  const maybeSingle = vi.fn().mockResolvedValueOnce({ data: current, error: null }).mockResolvedValueOnce({ data: result, error: null });
  const query = { eq, is, update, select, maybeSingle };
  for (const method of [eq, is, update, select]) method.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as unknown as SupabaseClient, from, eq, is, update };
}
describe("conditional schedule updates", () => {
  it("updates only dates on the same assignment and matches the original relationship/window", async () => {
    const mock = clientFor({ ...expected, id });
    expect((await updateClassActivity(mock.client, id, patch, expected)).error).toBeNull();
    expect(mock.update).toHaveBeenCalledExactlyOnceWith(patch);
    expect(mock.eq).toHaveBeenCalledWith("class_id", expected.class_id);
    expect(mock.eq).toHaveBeenCalledWith("activity_id", expected.activity_id);
    expect(mock.eq).toHaveBeenCalledWith("closes_at", expected.closes_at);
    expect(mock.is).toHaveBeenCalledWith("opens_at", null);
    expect(mock.from.mock.calls.every(([table]) => table === "class_activities")).toBe(true);
  });
  it.each(["class_id", "activity_id", "opens_at", "closes_at"])("does not overwrite a changed %s", async field => {
    const mock = clientFor({ ...expected, [field]: "different", id });
    expect((await updateClassActivity(mock.client, id, patch, expected)).error?.code).toBe("CONFLICT");
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("reports a conditional-update miss instead of claiming a confirmed write", async () => {
    const mock = clientFor({ ...expected, id }, null);
    expect((await updateClassActivity(mock.client, id, patch, expected)).error?.code).toBe("CONFLICT");
  });
});
