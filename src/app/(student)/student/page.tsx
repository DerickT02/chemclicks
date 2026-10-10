import Link from "next/link";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import RefreshAssignments from "@/components/assignments/RefreshAssignments";
import { hasActivityContent } from "@/lib/assignments/activity-content";
import { getNewAssignmentBlockReason } from "@/lib/activities/registry";
import { LEWIS_QUIZZES, lewisQuizForLesson } from "@/lib/assignments/lewis-quizzes";
import { groupWorkQueue, type QueueAssignment, type QueueSection } from "@/lib/assignments/work-queue";
import { getStudentWorkQueue } from "@/lib/server/student-work-queue";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "My Assignments | ChemClicks" };
export const dynamic = "force-dynamic";

const OPEN_SECTIONS: readonly QueueSection[] = ["not_started", "in_progress", "completed", "unknown", "unsupported"];
const ACTIONS = { not_started: "Open to start", in_progress: "Resume exploration", completed: "Review exploration", unknown: "Open activity" } as const;

function AssignmentCard({ assignment, section }: { assignment: QueueAssignment; section: QueueSection }) {
  const available = OPEN_SECTIONS.includes(section);
  const quizKind = available ? lewisQuizForLesson(assignment.activity.type) : null;
  const action = Object.hasOwn(ACTIONS, section) ? ACTIONS[section as keyof typeof ACTIONS] : null;
  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold">{assignment.activity.title}</h3>
      {section !== "invalid" && (
        <p className="text-sm text-muted-foreground">
          {assignment.opens_at && <>Opens <LocalizedTimestamp value={assignment.opens_at} />. </>}
          {assignment.closes_at ? <>Closes <LocalizedTimestamp value={assignment.closes_at} />.</> : "No closing deadline"}
        </p>
      )}
      {section === "not_started" && <p className="text-sm">Exploration not started.</p>}
      {section === "in_progress" && <p className="text-sm">Your current exploration is in progress.</p>}
      {section === "completed" && <p className="text-sm">Exploration completion saved. This is not a quiz grade.</p>}
      {section === "unknown" && <p className="text-sm text-muted-foreground">Progress unavailable. Open the activity to check your saved attempts.</p>}
      {section === "upcoming" && <p className="text-sm text-muted-foreground">Not open yet. Check back when this activity opens.</p>}
      {section === "closed" && <p className="text-sm text-muted-foreground">Closed — no further work can be submitted. Saved status and attempt history are not available here yet.</p>}
      {section === "invalid" && <p className="text-sm text-muted-foreground">The schedule could not be confirmed. Refresh assignments or ask your teacher.</p>}
      {!hasActivityContent(assignment.activity.type) && (
        <p className="text-sm text-muted-foreground">Exercise not available yet. {getNewAssignmentBlockReason(assignment.activity.type)}</p>
      )}
      {action && (
        <Link href={`/student/assignments/${assignment.id}`} prefetch={false}
          className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
          {action}<span className="sr-only">: {assignment.activity.title}</span>
        </Link>
      )}
      {quizKind && (
        <Link href={LEWIS_QUIZZES[quizKind].path} prefetch={false}
          className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground">
          Take quiz<span className="sr-only">: {assignment.activity.title}</span>
        </Link>
      )}
    </li>
  );
}

export default async function StudentAssignmentsPage() {
  const result = await getStudentWorkQueue();
  if (result.status === "unauthenticated") redirect("/login/student");
  const groups = result.status === "ok" ? groupWorkQueue(result.assignments, result.checkedAt) : [];
  const hasAvailable = groups.some(group => OPEN_SECTIONS.includes(group.id));
  const allAvailableCompleted = hasAvailable && groups.filter(group => OPEN_SECTIONS.includes(group.id))
    .every(group => group.id === "completed");
  const futureChanges = result.status === "ok" ? result.assignments.flatMap(assignment =>
    [assignment.opens_at, assignment.closes_at].flatMap(value => {
      const time = value === null ? NaN : Date.parse(value);
      return Number.isFinite(time) && time > result.checkedAt ? [time] : [];
    })) : [];
  const nextChangeAt = futureChanges.length ? futureChanges.reduce((earliest, time) => Math.min(earliest, time), Infinity) : null;

  return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">My assignments</h1>
          {result.status === "ok" && (
            <p className="font-medium">{result.context.studentName} · {result.context.className}
              {result.context.section && ` — ${result.context.section}`}</p>
          )}
          <p className="text-sm text-muted-foreground">Current saved exploration status, not quiz grades. Retrying an exploration moves it back to In progress.</p>
          <p className="text-sm text-muted-foreground">Opening an activity does not record participation. Use Start exploration inside the activity to begin tracking, then Finish exploration to save completion.</p>
          <p className="text-sm text-muted-foreground">Quiz answers and results are not saved or visible to your teacher.</p>
          <RefreshAssignments nextChangeAt={nextChangeAt} checkedAt={result.status === "ok" ? result.checkedAt : undefined} />
        </header>
        {result.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">{result.message}</p>
        ) : (
          <>
            {result.progressError && <p role="alert" className="text-sm text-destructive">{result.progressError}</p>}
            {result.assignments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
                Your teacher has not assigned any activities yet. Check back, refresh assignments, or use untracked practice below.
              </p>
            ) : !hasAvailable ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
                No activities are available right now. Check the schedules below or ask your teacher about your next activity.
              </p>
            ) : allAvailableCompleted && (
              <p className="rounded-lg border border-border p-6">Your available explorations are completed. You can review them while they remain open.</p>
            )}
            {groups.map(group => (
              <section key={group.id} aria-labelledby={`queue-${group.id}`} className="space-y-3">
                <h2 id={`queue-${group.id}`} className="text-xl font-semibold">{group.title} ({group.assignments.length})</h2>
                <ul className="space-y-4">
                  {group.assignments.map(assignment => <AssignmentCard key={assignment.id} assignment={assignment} section={group.id} />)}
                </ul>
              </section>
            ))}
          </>
        )}
        <aside className="space-y-2 rounded-lg border border-border p-5" aria-label="Untracked practice">
          <h2 className="text-lg font-semibold">Want more practice?</h2>
          <p className="text-sm text-muted-foreground">Practice is separate from assigned work and does not save exploration completion or quiz results for your teacher.</p>
          <Link href="/student/labs" className="text-sm font-semibold text-accent underline">Explore untracked practice</Link>
        </aside>
      </div>
    </main>
  );
}
