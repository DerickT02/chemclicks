import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const jar = vi.hoisted(() => ({ value: undefined as string | undefined, set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: () => jar.value ? { value: jar.value } : undefined,
  set: jar.set, delete: jar.delete,
}) }));
import { createStudentSession, getStudentSession } from "@/lib/auth/student-session";

const secret = "test-session-secret-never-used-outside-tests";
const studentId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
function signed(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}
beforeEach(() => { vi.stubEnv("STUDENT_SESSION_SECRET", secret); jar.value = undefined; vi.clearAllMocks(); });
afterEach(() => vi.unstubAllEnvs());

describe("signed student sessions", () => {
  it("accepts only a valid unexpired signature", async () => {
    jar.value = signed({ studentId, classId, expiresAt: Date.now() + 10000 });
    expect(await getStudentSession()).toMatchObject({ studentId, classId });
    jar.value += "tampered";
    expect(await getStudentSession()).toBeNull();
  });
  it.each([
    { studentId, classId, expiresAt: 0 },
    { studentId, classId },
    { studentId, classId, expiresAt: "9999999999999" },
    { studentId: "not-a-uuid", classId, expiresAt: 9999999999999 },
  ])("rejects invalid signed payload %j", async (payload) => {
    jar.value = signed(payload);
    expect(await getStudentSession()).toBeNull();
  });
  it("rejects missing cookies and extra signature segments", async () => {
    expect(await getStudentSession()).toBeNull();
    jar.value = `${signed({ studentId, classId, expiresAt: Date.now() + 10000 })}.extra`;
    expect(await getStudentSession()).toBeNull();
  });
  it("creates an HTTP-only cookie that can be verified", async () => {
    await createStudentSession(studentId, classId);
    const [, value, options] = jar.set.mock.calls[0];
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    jar.value = value;
    expect(await getStudentSession()).toMatchObject({ studentId, classId });
  });
});
