import { getTeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }): Promise<Response> {
  const { classId } = await params;
  const query = new URL(request.url).searchParams;
  const assignmentId = query.get("assignmentId");
  const studentId = query.get("studentId");
  if (!UUID_PATTERN.test(classId) || !assignmentId || !UUID_PATTERN.test(assignmentId) || !studentId || !UUID_PATTERN.test(studentId)) {
    return Response.json({ error: "Invalid class, assignment or student." }, { status: 400, headers });
  }
  try {
    const summary = await getTeacherActivityAttemptSummary(classId, assignmentId, { live: true, studentId });
    const student = summary.students.find(row => row.studentId === studentId);
    if (!student) return Response.json({ error: "Student unavailable." }, { status: 404, headers });
    return Response.json(student.attempts, { headers });
  } catch {
    return Response.json({ error: "Attempt history access denied or unavailable." }, { status: 403, headers });
  }
}
