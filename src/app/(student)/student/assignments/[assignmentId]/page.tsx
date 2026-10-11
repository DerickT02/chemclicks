import Link from "next/link";
import { getAssignmentAttempts } from '@/lib/server/student-assignments';
import AttemptControls from './AttemptControls';
import { notFound, redirect } from "next/navigation";
import { getStudentAssignments } from "@/lib/db/student-assignments";
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
import MeasurementComparison from "@/components/measurement/MeasurementComparison";
import LewisDotExplorer from "@/components/lewis/LewisDotExplorer";
import IonicCompoundExplorer from "@/components/lewis/IonicCompoundExplorer";
import CovalentBondExplorer from "@/components/lewis/CovalentBondExplorer";
import LewisQuizCard from "@/components/quiz/lewis/LewisQuizCard";

import { hasActivityContent } from "@/lib/assignments/activity-content";
import { lewisQuizForLesson } from "@/lib/assignments/lewis-quizzes";

export const dynamic = "force-dynamic";

export default async function AssignmentPage({ params }: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  // Same authorized reader as the list; no client-supplied class/student IDs.
  const result = await getStudentAssignments();
  if (result.status === "unauthenticated") redirect("/login/student");
  if (result.status === "error") throw new Error(result.message);
  const assignment = result.assignments.find((item) => item.id === assignmentId);
  if (!assignment) notFound();

  const type = assignment.activity.type;
  const quizKind = lewisQuizForLesson(type);
  const attempts = hasActivityContent(type) ? await getAssignmentAttempts(assignmentId) : [];
  const latest = attempts[0];
  return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/student" className="text-accent underline">Back to assignments</Link>
        <h1 className="text-3xl font-semibold">{assignment.activity.title}</h1>
        <AssignmentAccess key={`${assignment.id}:${assignment.closes_at}`} closesAt={assignment.closes_at}>
          {hasActivityContent(type) && (
            <section aria-label="Exploration attempts" className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-3 text-lg font-semibold">Exploration attempts</h2>
              <AttemptControls key={latest?.id ?? 'new'} assignmentId={assignmentId} attemptId={latest?.id} completed={latest?.status === 'completed'} />
              <p className="mt-3 text-sm text-muted-foreground">{attempts.length} attempts. Completion records exploration participation, not a quiz score.</p>
              <ul className="mt-3 space-y-2 text-sm">
                {attempts.map(attempt => <li key={attempt.id}>
                  Attempt {attempt.attempt_number}: {attempt.status === 'completed' ? 'Completed' : 'In progress'} — started {new Date(attempt.started_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
                  {attempt.completed_at && <>; completed {new Date(attempt.completed_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</>}
                </li>)}
              </ul>
            </section>
          )}
          <section className="rounded-xl border border-border bg-card p-6">
            {type === "lewis_diagram" && <LewisDotExplorer />}
            {type === "lewis_structures_ionic" && <IonicCompoundExplorer />}
            {type === "lewis_structures_covalent" && <CovalentBondExplorer />}
            {type === "measurement_graduated_cylinder" && <MeasurementComparison instrument="cylinder" />}
            {(type === "measurement_ruler_tenths" || type === "measurement_ruler_hundredths") && (
              <MeasurementComparison instrument="ruler" />
            )}
            {!hasActivityContent(type) && (
              <p className="text-muted-foreground">This activity’s exercise is not available yet.</p>
            )}
          </section>
        </AssignmentAccess>
        {quizKind && <LewisQuizCard kind={quizKind} assignments={result.assignments} />}
      </div>
    </main>
  );
}
