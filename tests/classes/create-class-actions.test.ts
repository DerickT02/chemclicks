import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mock = vi.hoisted(() => ({
  teacher: vi.fn(),
  getUser: vi.fn(),
  find: vi.fn(),
  insert: vi.fn(),
  random: vi.fn(),
  requestClient: { name: "request" },
  adminClient: { name: "admin" },
}));

vi.mock("@/lib/server/teacher", () => ({ requireTeacherId: mock.teacher }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ ...mock.requestClient, auth: { getUser: mock.getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mock.adminClient }));
vi.mock("@/lib/db/classes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/classes")>()),
  findClassByCode: mock.find,
  insertClass: mock.insert,
}));
vi.mock("@/lib/classes/class-code", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/classes/class-code")>()),
  randomClassCode: mock.random,
}));

import { createClass, generateClassCode } from "@/app/admin/create-class/actions";

const duplicateCode = {
  code: "23505",
  message: 'duplicate key value violates unique constraint "classes_class_code_key"',
};
const input = { className: " Chem 3 ", section: " Room 204 ", classCode: "a1b2c3" };

function inserted(class_code: string) {
  return { data: { id: "class-1", class_code }, error: null };
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.teacher.mockResolvedValue("teacher-a");
  mock.getUser.mockResolvedValue({ data: { user: { id: "teacher-a" } }, error: null });
  mock.find.mockResolvedValue({ exists: false, error: null });
  mock.insert.mockImplementation(async (_client, row) => inserted(row.class_code));
});

describe("generateClassCode", () => {
  it("retries after a collision and returns an unused code", async () => {
    mock.random.mockReturnValueOnce("TAKEN1").mockReturnValueOnce("FRESH2");
    mock.find
      .mockResolvedValueOnce({ exists: true, error: null })
      .mockResolvedValueOnce({ exists: false, error: null });

    expect(await generateClassCode()).toEqual({ ok: true, code: "FRESH2" });
    expect(mock.find.mock.calls).toEqual([
      [mock.adminClient, "TAKEN1"],
      [mock.adminClient, "FRESH2"],
    ]);
  });

  it("fails safely after five collisions", async () => {
    mock.random.mockReturnValue("TAKEN1");
    mock.find.mockResolvedValue({ exists: true, error: null });

    const result = await generateClassCode();
    expect(result).toEqual({ ok: false, message: expect.stringContaining("unique code") });
    expect(mock.find).toHaveBeenCalledTimes(5);
  });

  it("does not expose lookup errors", async () => {
    mock.random.mockReturnValue("ABC123");
    mock.find.mockResolvedValue({ exists: false, error: { message: "private details" } });

    const result = await generateClassCode();
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private details");
  });

  it("requires a teacher before any database access", async () => {
    mock.teacher.mockRejectedValue(new Error("Unauthorized"));

    expect((await generateClassCode()).ok).toBe(false);
    expect(mock.find).not.toHaveBeenCalled();
    expect(mock.random).not.toHaveBeenCalled();
  });
});

describe("createClass", () => {
  it("saves a manual code normalized to uppercase", async () => {
    expect(await createClass(input)).toEqual({ ok: true, classId: "class-1", classCode: "A1B2C3" });
    expect(mock.insert).toHaveBeenCalledWith(mock.adminClient, {
      teacher_id: "teacher-a",
      name: "Chem 3",
      section: "Room 204",
      class_code: "A1B2C3",
    });
  });

  it("saves a generated code through the same checks", async () => {
    const result = await createClass({ ...input, classCode: "Z9Y8X7", codeSource: "generated" });

    expect(result).toEqual({ ok: true, classId: "class-1", classCode: "Z9Y8X7" });
    expect(mock.find).toHaveBeenCalledWith(expect.objectContaining({ name: "request" }), "Z9Y8X7");
  });

  it("rejects a duplicate manual code without creating a class", async () => {
    mock.find.mockResolvedValue({ exists: true, error: null });

    const result = await createClass(input);
    expect(result).toEqual({ ok: false, field: "classCode", message: expect.stringContaining("already in use") });
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("does not replace a manual code that collides at insert", async () => {
    mock.insert.mockResolvedValue({ data: null, error: duplicateCode });

    const result = await createClass(input);
    expect(result).toEqual({ ok: false, field: "classCode", message: expect.stringContaining("already in use") });
    expect(mock.insert).toHaveBeenCalledTimes(1);
    expect(mock.random).not.toHaveBeenCalled();
  });

  it("retries a generated code that collides at insert and returns the saved code", async () => {
    mock.insert
      .mockResolvedValueOnce({ data: null, error: duplicateCode })
      .mockImplementation(async (_client, row) => inserted(row.class_code));
    mock.random.mockReturnValue("NEW456");

    const result = await createClass({ ...input, classCode: "OLD123", codeSource: "generated" });
    expect(result).toEqual({ ok: true, classId: "class-1", classCode: "NEW456" });
    expect(mock.insert.mock.calls.map(([, row]) => row.class_code)).toEqual(["OLD123", "NEW456"]);
    expect(mock.find).toHaveBeenLastCalledWith(mock.adminClient, "NEW456");
  });

  it("stops retrying generated codes after five insert collisions", async () => {
    mock.insert.mockResolvedValue({ data: null, error: duplicateCode });
    mock.random.mockReturnValue("NEW456");

    const result = await createClass({ ...input, classCode: "OLD123", codeSource: "generated" });
    expect(result).toEqual({ ok: false, field: "classCode", message: expect.stringContaining("unique code") });
    expect(mock.insert).toHaveBeenCalledTimes(5);
  });

  it.each(["manual", "generated"] as const)("rejects an invalid %s code before database access", async (codeSource) => {
    const result = await createClass({ ...input, classCode: "AB-12", codeSource });

    expect(result).toEqual({ ok: false, field: "classCode", message: expect.stringContaining("6 letters") });
    expect(mock.find).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("treats an unknown code source as manual", async () => {
    mock.insert.mockResolvedValue({ data: null, error: duplicateCode });

    const result = await createClass({ ...input, codeSource: "other" as "manual" });
    expect(result.ok).toBe(false);
    expect(mock.random).not.toHaveBeenCalled();
  });
});
