import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  claims: vi.fn(),
  student: vi.fn(),
  classroom: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.claims } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({
        eq: () => ({ maybeSingle: mocks.classroom }),
        maybeSingle: table === "students" ? mocks.student : mocks.classroom,
      }) }),
    }),
  }),
}));

import { getStudentSession } from "@/lib/auth/student-session";

const authUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const studentId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: authUserId } }, error: null });
  mocks.student.mockResolvedValue({ data: { id: studentId, class_id: classId }, error: null });
  mocks.classroom.mockResolvedValue({ data: { id: classId }, error: null });
});

describe("Supabase student sessions", () => {
  it("resolves a verified user to its student and active class", async () => {
    expect(await getStudentSession()).toEqual({ studentId, classId });
  });

  it("rejects requests without verified claims", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: null }, error: null });
    expect(await getStudentSession()).toBeNull();
    expect(mocks.student).not.toHaveBeenCalled();
  });

  it("rejects users not linked to a student", async () => {
    mocks.student.mockResolvedValue({ data: null, error: null });
    expect(await getStudentSession()).toBeNull();
  });

  it("rejects students in inactive classrooms", async () => {
    mocks.classroom.mockResolvedValue({ data: null, error: null });
    expect(await getStudentSession()).toBeNull();
  });
});
