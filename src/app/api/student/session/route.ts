import { NextResponse } from "next/server";
import { clearStudentSession, getStudentSession } from "@/lib/auth/student-session";

export async function GET() {
  const session = await getStudentSession();
  return NextResponse.json({ authenticated: Boolean(session) });
}

export async function DELETE() {
  await clearStudentSession();
  return NextResponse.json({ authenticated: false });
}
