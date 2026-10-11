import Link from "next/link";
import AttemptHistory from "@/components/assignments/AttemptHistory";
import { getAssignmentAttempts } from '@/lib/server/student-assignments';
import AttemptControls from './AttemptControls';
import { notFound, redirect } from "next/navigation";
import { getStudentAssignmentSchedules } from "@/lib/db/student-assignments";
import { scheduleStatus } from "@/lib/assignments/schedule";
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
  // Own-class metadata; opening access and saved-history access are separate.
  const result = await getStudentAssignmentSchedules();
  if (result.status === "unauthenticated") redirect("/login/student");
  if (result.status === "error") throw new Error(result.message);
  const assignment = result.assignments.find((item) => item.id === assignmentId);
  if (!assignment) notFound();

  // eslint-disable-next-line react-hooks/purity -- Request-time Server Component availability check.
  const status = scheduleStatus(assignment, Date.now());
  if (status === "Closed") redirect(`/student/assignments/${assignment.id}/history`);
  if (status !== "Open") return (
    <main className="min-h-screen-below-nav space-y-4 bg-background px-6 py-10 text-foreground">
      <Link href="/student" className="underline">Back to assignments</Link>
      <h1 className="text-3xl font-semibold">{assignment.activity.title}</h1>
      <p role="status">This activity is not available right now. Check its schedule on My assignments or ask your teacher.</p>
    </main>
  );
  const type = assignment.activity.type;
  const definition = getActivityDefinition(type);
  const explorer = definition?.explorer;
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
            <section aria-label="Exploration instructions" className="space-y-3 rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">Goal: {definition?.description}</h2>
              <p className="text-sm text-muted-foreground">Start exploration to record participation, try a few examples or readings below, then use Finish exploration after the exercise. Opening the page alone does not save completion.</p>
              {latest?.status === "completed" ? <p role="status">Completion saved. This records exploration participation, not a quiz score. You can review the exercise without starting again.</p>
                : latest ? <p>Your exploration is in progress. Continue below, then save your completion.</p> : null}
              {(!latest || latest.status === "completed") && <AttemptControls key={latest?.id ?? 'new'} assignmentId={assignmentId} attemptId={latest?.id} completed={latest?.status === 'completed'} />}
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
          {latest?.status === "in_progress" && <section aria-label="Finish exploration" className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm">Finished exploring? Save your participation below, then return to assignments or take an available quiz.</p>
            <AttemptControls key={latest.id} assignmentId={assignmentId} attemptId={latest.id} completed={false} />
          </section>}
          {hasActivityContent(type) && <AttemptHistory attempts={attempts} />}
        </AssignmentAccess>
        {quizKind && <LewisQuizCard kind={quizKind} assignments={result.assignments} />}
      </div>
    </main>
  );
}
