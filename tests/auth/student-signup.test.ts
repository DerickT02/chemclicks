import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  classSingle: vi.fn(),
  insertStudent: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/auth/student-supabase-auth", () => ({
  createStudentAuthEmail: () => "hidden-student@example.com",
}));

import { createStudentAccount } from "@/app/create-account/student/actions";

const authUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const classId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.classSingle.mockResolvedValue({
    data: { id: classId, is_active: true },
    error: null,
  });
  mocks.createUser.mockResolvedValue({ data: { user: { id: authUserId } }, error: null });
  mocks.deleteUser.mockResolvedValue({ data: {}, error: null });
  mocks.insertStudent.mockResolvedValue({ error: null });
  mocks.createAdminClient.mockReturnValue({
    auth: {
      admin: {
        createUser: mocks.createUser,
        deleteUser: mocks.deleteUser,
      },
    },
    from: (table: string) => table === "classes"
      ? {
          select: () => ({
            eq: () => ({ maybeSingle: mocks.classSingle }),
          }),
        }
      : { insert: mocks.insertStudent },
  });
});

describe("student account creation", () => {
  it("creates one passwordless Auth user and uses its UUID for the student row", async () => {
    await expect(createStudentAccount(" Ada ", " Lovelace ", " S123 ", " abc123 "))
      .resolves.toEqual({ ok: true });

    expect(mocks.createUser).toHaveBeenCalledWith({
      email: "hidden-student@example.com",
      email_confirm: true,
      app_metadata: { account_type: "student" },
    });
    expect(mocks.insertStudent).toHaveBeenCalledWith({
      id: authUserId,
      class_id: classId,
      first_name: "Ada",
      last_name: "Lovelace",
      student_id: "S123",
    });
  });

  it("deletes the Auth user when the student row cannot be inserted", async () => {
    mocks.insertStudent.mockResolvedValue({ error: { code: "23505" } });

    await expect(createStudentAccount("Ada", "Lovelace", "S123", "ABC123"))
      .resolves.toEqual({
        ok: false,
        field: "studentID",
        message: "That Student ID is already registered.",
      });

    expect(mocks.deleteUser).toHaveBeenCalledWith(authUserId);
  });

  it("validates input before calling privileged Supabase APIs", async () => {
    await expect(createStudentAccount("", "Lovelace", "S123", "ABC123"))
      .resolves.toMatchObject({ ok: false, field: "firstName" });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
