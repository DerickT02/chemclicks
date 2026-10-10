import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ disable: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/server/classes", () => ({ disableOwnedClass: mocks.disable }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { disableClass } from "@/app/admin/classes/actions";

const classId = "11111111-1111-4111-8111-111111111111";
const initial = { status: "idle" as const, message: "" };
function form(id = classId, confirmation = "disable") {
  const data = new FormData();
  data.set("class_id", id);
  data.set("confirmation", confirmation);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.disable.mockResolvedValue(undefined);
});

describe("disable-class action", () => {
  it.each([["", "disable"], ["invalid", "disable"], [classId, ""], [classId, "true"]])("rejects invalid or unconfirmed requests (%s, %s)", async (id, confirmation) => {
    expect((await disableClass(initial, form(id, confirmation))).status).toBe("error");
    expect(mocks.disable).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects files rather than coercing untrusted form data", async () => {
    const data = form();
    data.set("class_id", new Blob([classId]), "id.txt");
    expect((await disableClass(initial, data)).status).toBe("error");
    expect(mocks.disable).not.toHaveBeenCalled();
  });
  it("uses the authorized helper and refreshes class-dependent layouts only after success", async () => {
    const data = form();
    data.set("teacher_id", "someone-else");
    const result = await disableClass(initial, data);
    expect(result.status).toBe("success");
    expect(mocks.disable).toHaveBeenCalledExactlyOnceWith(classId);
    expect(mocks.revalidate.mock.calls).toEqual([["/admin", "layout"], ["/student", "layout"]]);
  });
  it.each(["Unauthorized", "Class could not be disabled.", "private database credentials"])('returns a safe error without refreshing on failure (%s)', async message => {
    mocks.disable.mockRejectedValue(new Error(message));
    const result = await disableClass(initial, form());
    expect(result.status).toBe("error");
    expect(result.message).toContain("could not confirm");
    expect(result.message).not.toContain(message);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not turn a confirmed flag update into a failed-write claim if cache refresh fails", async () => {
    mocks.revalidate.mockImplementation(() => { throw new Error("cache unavailable"); });
    expect(await disableClass(initial, form())).toEqual({ status: "success", message: "Class disabled. Refresh the page to update classrooms." });
    expect(mocks.disable).toHaveBeenCalledTimes(1);
  });
});
