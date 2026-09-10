import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const STUDENT_SESSION_COOKIE = "chemclicks_student_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type StudentSession = {
  studentId: string;
  classId: string;
  expiresAt: number;
};

function getSessionSecret(): string {
  const secret = process.env.STUDENT_SESSION_SECRET;
  if (!secret) {
    throw new Error("STUDENT_SESSION_SECRET is not configured.");
  }
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export async function createStudentSession(studentId: string, classId: string) {
  const session: StudentSession = {
    studentId,
    classId,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const payload = encode(JSON.stringify(session));
  const value = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();

  cookieStore.set(STUDENT_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getStudentSession(): Promise<StudentSession | null> {
  const value = (await cookies()).get(STUDENT_SESSION_COOKIE)?.value;
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(decode(payload)) as StudentSession;
    if (!session.studentId || !session.classId || session.expiresAt <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearStudentSession() {
  (await cookies()).delete(STUDENT_SESSION_COOKIE);
}
