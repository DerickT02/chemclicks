import Link from "next/link";
import { getAssignmentAttempts } from '@/lib/server/student-assignments';
import AttemptControls from './AttemptControls';
import { notFound, redirect } from "next/navigation";
import { getStudentAssignments } from "@/lib/db/student-assignments";
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
import GraduatedCylinder from "@/components/measurement/GraduatedCylinder";
import PrecisionRuler from "@/components/measurement/PrecisionRuler";
import LewisDotExplorer from "@/components/lewis/LewisDotExplorer";
import IonicCompoundExplorer from "@/components/lewis/IonicCompoundExplorer";
import CovalentBondExplorer from "@/components/lewis/CovalentBondExplorer";
import LewisQuizCard from "@/components/quiz/lewis/LewisQuizCard";

import { hasActivityContent } from "@/lib/assignments/activity-content";
import { getActivityDefinition, getNewAssignmentBlockReason } from "@/lib/activities/registry";
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
  const explorer = getActivityDefinition(type)?.explorer;
  const quizKind = lewisQuizForLesson(type);
  const attempts = hasActivityContent(type) ? await getAssignmentAttempts(assignmentId) : [];
  const latest = attempts[0];
  return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/student" className="text-accent underline">Back to assignments</Link>
        <h1 className="text-3xl font-semibold">{assignment.activity.title}</h1>
        <AssignmentAccess key={assignment.id} closesAt={assignment.closes_at}>
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
            {explorer === "lewis-diagram" && <LewisDotExplorer />}
            {explorer === "ionic" && <IonicCompoundExplorer />}
            {explorer === "covalent" && <CovalentBondExplorer />}
            {explorer === "cylinder" && <GraduatedCylinder />}
            {explorer === "ruler" && <PrecisionRuler />}
            {!hasActivityContent(type) && (
              <div className="space-y-2 text-muted-foreground" role="status">
                <p>This activity’s exercise is not available yet.</p>
                <p>{getNewAssignmentBlockReason(type)}</p>
              </div>
            )}
          </section>
        </AssignmentAccess>
        {quizKind && <LewisQuizCard kind={quizKind} assignments={result.assignments} />}
      </div>
    </main>
  );
}
