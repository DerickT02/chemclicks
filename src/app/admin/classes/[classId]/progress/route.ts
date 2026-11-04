import { getTeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";
import { getTeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";

const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }): Promise<Response> {
  const { classId } = await params;
  const assignmentId = new URL(request.url).searchParams.get("assignmentId");
  if (!UUID_PATTERN.test(classId) || (assignmentId !== null && !UUID_PATTERN.test(assignmentId))) {
    return Response.json({ error: "Invalid class or assignment." }, { status: 400, headers });
  }

  try {
    // Both readers verify the current teacher session and class ownership on
    // every request. No client-supplied teacher identity is accepted.
    const data = assignmentId === null
      ? await getTeacherClassLessonProgress(classId)
      : await getTeacherActivityAttemptSummary(classId, assignmentId);
    return Response.json(data, { headers });
  } catch {
    // Do not expose student data or database details when access/read checks fail.
    return Response.json({ error: "Progress access denied or unavailable." }, { status: 403, headers });
  }
}
