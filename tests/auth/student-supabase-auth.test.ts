import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp: mocks.verifyOtp } }),
}));

import {
  createStudentAuthEmail,
  createStudentSupabaseSession,
} from "@/lib/auth/student-supabase-auth";

const studentId = "11111111-1111-4111-8111-111111111111";
const internalEmail = "student-hidden@students.auth.chemclicks.invalid";
const tokenHash = "one-time-token-hash";

function adminClient(returnedAuthUserId = studentId) {
  const getUserById = vi.fn().mockResolvedValue({
    data: { user: { id: studentId, email: internalEmail } },
    error: null,
  });
  const generateLink = vi.fn().mockResolvedValue({
    data: {
      user: { id: returnedAuthUserId },
      properties: { hashed_token: tokenHash },
    },
    error: null,
  });

  return {
    client: {
      auth: { admin: { getUserById, generateLink } },
    } as unknown as SupabaseClient,
    generateLink,
    getUserById,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyOtp.mockResolvedValue({ error: null });
});

describe("passwordless student Supabase Auth", () => {
  it("generates unique non-deliverable internal emails", () => {
    const first = createStudentAuthEmail();
    const second = createStudentAuthEmail();

    expect(first).toMatch(/^student-[0-9a-f-]+@students\.auth\.chemclicks\.invalid$/);
    expect(second).not.toBe(first);
  });

  it("exchanges the student's hidden identity for a Supabase session", async () => {
    const admin = adminClient();

    await expect(createStudentSupabaseSession(admin.client, {
      id: studentId,
    })).resolves.toBeNull();

    expect(admin.getUserById).toHaveBeenCalledWith(studentId);
    expect(admin.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: internalEmail,
    });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: tokenHash,
      type: "magiclink",
    });
  });

  it("rejects a generated link for a different Auth user", async () => {
    const admin = adminClient("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    await expect(createStudentSupabaseSession(admin.client, {
      id: studentId,
    })).resolves.toBe("Could not create a student session. Please try again.");

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
});
