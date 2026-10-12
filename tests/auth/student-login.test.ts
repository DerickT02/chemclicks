import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createSession: vi.fn(),
  classLookup: vi.fn(),
  studentLookup: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/auth/student-supabase-auth", () => ({ createStudentSupabaseSession: mocks.createSession }));

import { loginStudent } from "@/app/login/student/actions";

const student = { id: "student-row", auth_user_id: null };
const failure = { ok: false, field: "form", message: SESSION_RETRY_MESSAGE };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.classLookup.mockResolvedValue({ data: { id: "class-row" }, error: null });
  mocks.studentLookup.mockResolvedValue({ data: student, error: null });
  mocks.createSession.mockResolvedValue(null);
  mocks.createAdminClient.mockImplementation(() => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: mocks.eq,
        maybeSingle: table === "classes" ? mocks.classLookup : mocks.studentLookup,
      };
      mocks.eq.mockReturnValue(chain);
      return chain;
    },
  }));
});

describe("student login action", () => {
  it("reports success only after confirmed session creation", async () => {
    expect(await loginStudent(" DEMO1 ", " abc123 ")).toEqual({ ok: true });
    expect(mocks.createSession).toHaveBeenCalledWith(expect.anything(), student);
    expect(mocks.eq).toHaveBeenCalledWith("class_code", "ABC123");
    expect(mocks.eq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.eq).toHaveBeenCalledWith("class_id", "class-row");
    expect(mocks.eq).toHaveBeenCalledWith("student_id", "DEMO1");
  });

  it.each(["token exchange failed", "student/Auth linking failed"])("handles a returned session error: %s", async (error) => {
    mocks.createSession.mockResolvedValue(error);
    expect(await loginStudent("DEMO1", "ABC123")).toEqual(failure);
  });

  it("handles unexpected session exceptions without exposing details", async () => {
    mocks.createSession.mockRejectedValue(new Error("private token"));
    expect(await loginStudent("DEMO1", "ABC123")).toEqual(failure);
  });

  it("handles missing server configuration", async () => {
    mocks.createAdminClient.mockImplementation(() => { throw new Error("missing service key"); });
    expect(await loginStudent("DEMO1", "ABC123")).toEqual(failure);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("handles thrown lookup failures", async () => {
    mocks.studentLookup.mockRejectedValue(new Error("network failure"));
    expect(await loginStudent("DEMO1", "ABC123")).toEqual(failure);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("does not create a session for missing students or inactive/missing classes", async () => {
    mocks.classLookup.mockResolvedValue({ data: null, error: null });
    expect((await loginStudent("DEMO1", "ABC123")).ok).toBe(false);
    expect(mocks.studentLookup).not.toHaveBeenCalled();
    mocks.classLookup.mockResolvedValue({ data: { id: "class-row" }, error: null });
    mocks.studentLookup.mockResolvedValue({ data: null, error: null });
    expect((await loginStudent("DEMO1", "ABC123")).ok).toBe(false);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects invalid input before database access", async () => {
    expect((await loginStudent(" ", "ABC123")).ok).toBe(false);
    expect((await loginStudent("DEMO1", " ")).ok).toBe(false);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
