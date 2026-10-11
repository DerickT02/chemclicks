import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AttemptHistory from "@/components/assignments/AttemptHistory";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import { getStudentAssignmentSchedules } from "@/lib/db/student-assignments";
import { getAssignmentAttempts } from "@/lib/server/student-assignments";
import { scheduleStatus } from "@/lib/assignments/schedule";

export const dynamic = "force-dynamic";

export default async function AssignmentHistoryPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const result = await getStudentAssignmentSchedules();
  if (result.status === "unauthenticated") redirect("/login/student");
  if (result.status === "error") throw new Error(result.message);
  const assignment = result.assignments.find(row => row.id === assignmentId);
  if (!assignment) notFound();
  // eslint-disable-next-line react-hooks/purity -- Request-time Server Component availability check.
  const status = scheduleStatus(assignment, Date.now());
  const readable = status === "Open" || status === "Closed";
  const attempts = readable ? await getAssignmentAttempts(assignmentId) : [];
  const completed = attempts.some(attempt => attempt.status === "completed");

  return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/student" className="text-foreground underline">Back to assignments</Link>
        <h1 className="text-3xl font-semibold">{assignment.activity.title} — saved history</h1>
        {readable ? <>
          <p className="text-sm text-muted-foreground">{status === "Closed" ? "This assignment is closed. No further work can be submitted." : "This is a read-only view of your saved exploration history."}</p>
          {assignment.closes_at && <p className="text-sm text-muted-foreground">Closing time: <LocalizedTimestamp value={assignment.closes_at} /></p>}
          <p className="font-medium">{completed ? "Exploration completion saved." : "No exploration completion has been saved."}</p>
          <AttemptHistory attempts={attempts} />
          {status === "Open" && <Link href={`/student/assignments/${assignment.id}`} className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-semibold">Back to activity</Link>}
        </> : <p role="status">Saved history is unavailable until the activity opens with a valid schedule. Return to assignments or ask your teacher.</p>}
      </div>
    </main>
  );
}
