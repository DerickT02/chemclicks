import { getTeacherClassUpdates, isClassUpdateCursor } from "@/lib/server/teacher-class-updates";

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }): Promise<Response> {
  const { classId } = await params;
  const query = new URL(request.url).searchParams;
  const after = query.get("after");
  const assignmentId = query.get("assignmentId");
  if (!UUID.test(classId) || (after !== null && !isClassUpdateCursor(after))
    || (assignmentId !== null && !UUID.test(assignmentId))) {
    return Response.json({ error: "Invalid class update request." }, { status: 400, headers });
  }
  try {
    const data = await getTeacherClassUpdates(classId, {
      ...(after !== null ? { after } : {}), ...(assignmentId !== null ? { assignmentId } : {}),
    });
    return Response.json(data, { headers });
  } catch {
    return Response.json({ error: "Class updates access denied or unavailable." }, { status: 403, headers });
  }
}
