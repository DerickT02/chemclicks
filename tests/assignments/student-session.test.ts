import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  claims: vi.fn(),
  from: vi.fn(),
  studentSingle: vi.fn(),
  classSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: mocks.claims,
    },
    from: mocks.from,
  }),
}));

import { getStudentSession } from "@/lib/auth/student-session";

const authUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const studentId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: authUserId } }, error: null });
  mocks.studentSingle.mockResolvedValue({
    data: { id: studentId, class_id: classId },
    error: null,
  });
  mocks.classSingle.mockResolvedValue({ data: { id: classId }, error: null });
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: table === "students" ? mocks.studentSingle : mocks.classSingle,
      }),
    }),
  }));
});

describe("Supabase student sessions", () => {
  it("resolves a verified Auth user to its student row", async () => {
    await expect(getStudentSession()).resolves.toEqual({
      authUserId,
      studentId,
      classId,
    });
    expect(mocks.from).toHaveBeenCalledWith("students");
    expect(mocks.from).toHaveBeenCalledWith("classes");
  });

  it("rejects requests without verified claims", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: null }, error: null });
    await expect(getStudentSession()).resolves.toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects authenticated users without a linked student row", async () => {
    mocks.studentSingle.mockResolvedValue({ data: null, error: null });
    await expect(getStudentSession()).resolves.toBeNull();
  });

  it("rejects students whose classroom is inactive or unavailable", async () => {
    mocks.classSingle.mockResolvedValue({ data: null, error: null });
    await expect(getStudentSession()).resolves.toBeNull();
  });

});
