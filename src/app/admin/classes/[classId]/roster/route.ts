import { getOwnedStudentRoster } from "@/lib/server/student-roster";

const UUID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ classId: string }> }): Promise<Response> {
  const { classId } = await params;
  if (!UUID_PATTERN.test(classId)) {
    return Response.json({ error: "Invalid class." }, { status: 400, headers });
  }

  try {
    // The reader verifies the current teacher session and active class ownership
    // on every request, and returns only the roster fields needed by the view.
    const roster = await getOwnedStudentRoster(classId);
    return Response.json(roster, { headers });
  } catch {
    return Response.json({ error: "Student roster access denied or unavailable." }, { status: 403, headers });
  }
}
