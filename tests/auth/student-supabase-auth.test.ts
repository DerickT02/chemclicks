import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const verifyOtp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

import { createStudentSupabaseSession } from "@/lib/auth/student-supabase-auth";

const studentId = "11111111-1111-4111-8111-111111111111";
const authUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionError = "Could not create a student session. Please try again.";

function adminClient(userId = authUserId) {
  const generateLink = vi.fn().mockResolvedValue({
    data: { user: { id: userId }, properties: { hashed_token: "one-time-token" } },
    error: null,
  });
  const updateSingle = vi.fn().mockResolvedValue({
    data: { auth_user_id: authUserId }, error: null,
  });
  const from = vi.fn().mockReturnValue({
    update: () => ({ eq: () => ({ is: () => ({
      select: () => ({ maybeSingle: updateSingle }),
    }) }) }),
  });
  return {
    client: { auth: { admin: { generateLink } }, from } as unknown as SupabaseClient,
    generateLink,
    updateSingle,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ error: null });
});

describe("passwordless student Supabase Auth", () => {
  it("links an existing student on first login and exchanges a server-only token", async () => {
    const admin = adminClient();
    expect(await createStudentSupabaseSession(admin.client, {
      id: studentId, auth_user_id: null,
    })).toBeNull();
    expect(admin.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: `student-${studentId}@students.auth.chemclicks.invalid`,
    });
    expect(admin.updateSingle).toHaveBeenCalled();
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "one-time-token", type: "magiclink" });
  });

  it("reuses the existing link without updating the student row", async () => {
    const admin = adminClient();
    expect(await createStudentSupabaseSession(admin.client, {
      id: studentId, auth_user_id: authUserId,
    })).toBeNull();
    expect(admin.updateSingle).not.toHaveBeenCalled();
  });

  it("refuses to sign into a different Auth user", async () => {
    const admin = adminClient("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(await createStudentSupabaseSession(admin.client, {
      id: studentId, auth_user_id: authUserId,
    })).toBe(sessionError);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
