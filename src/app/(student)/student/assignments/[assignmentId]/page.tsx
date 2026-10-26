import Link from "next/link";
import AttemptHistory from "@/components/assignments/AttemptHistory";
import QuizAttemptHistory from "@/components/assignments/QuizAttemptHistory";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import { getAssignmentAttempts } from '@/lib/server/student-assignments';
import AttemptControls from './AttemptControls';
import { notFound, redirect } from "next/navigation";
import { getStudentAssignmentSchedules } from "@/lib/db/student-assignments";
import { scheduleStatus } from "@/lib/assignments/schedule";
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
import BohrModelViewer from "@/components/bohr-models/BohrModelViewer";
import MeasurementComparison from "@/components/measurement/MeasurementComparison";
import LewisDotExplorer from "@/components/lewis/LewisDotExplorer";
import IonicCompoundExplorer from "@/components/lewis/IonicCompoundExplorer";
import CovalentBondExplorer from "@/components/lewis/CovalentBondExplorer";
import LewisQuizCard from "@/components/quiz/lewis/LewisQuizCard";
import MeasurementQuiz from "@/components/measurement/MeasurementQuiz";
import LockedSection from "@/components/assignments/LockedSection";

import { hasActivityContent } from "@/lib/assignments/activity-content";
import { getActivityDefinition, getNewAssignmentBlockReason } from "@/lib/activities/registry";
import { lewisQuizForLesson } from "@/lib/assignments/lewis-quizzes";
import { measurementAttemptLabel, measurementQuizModeForActivity } from "@/lib/measurement/modes";
import { getAssignmentGate } from "@/lib/assignments/prerequisites";
import { assignmentPath } from "@/lib/assignments/sequence";

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
      <h1 className="text-3xl font-semibold">{assignment.activity.title}</h1>
      <p role="status">This activity is not available right now. Check its schedule on My assignments or ask your teacher.</p>
    </main>
  );
  // Earlier sections must be finished first, even when this URL is opened directly.
  const gate = await getAssignmentGate(assignmentId);
  if (gate.status === "unauthenticated") redirect("/login/student");
  if (gate.status === "error") throw new Error(gate.message);
  if (gate.status === "locked") return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-semibold">{assignment.activity.title}</h1>
        <LockedSection blocker={gate.blocker} />
      </div>
    </main>
  );
  const type = assignment.activity.type;
  const definition = getActivityDefinition(type);
  const explorer = definition?.explorer;
  const quizKind = lewisQuizForLesson(type);
  const measurementQuizMode = measurementQuizModeForActivity(type);
  const attempts = hasActivityContent(type) ? await getAssignmentAttempts(assignmentId) : [];
  // Quiz attempts share the table; exploration rows carry no quiz key.
  const explorationAttempts = attempts.filter((attempt) => !attempt.quiz_key);
  const bohrQuizAttempts = attempts.filter((attempt) => attempt.quiz_key === "bohr_models");
  const measurementAttempts = attempts.filter((attempt) => attempt.instrument !== null && attempt.instrument !== undefined);
  const latest = explorationAttempts[0];
  return (
    <main className="min-h-screen-below-nav bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-semibold">{assignment.activity.title}</h1>
        <AssignmentAccess key={assignment.id} closesAt={assignment.closes_at}>
          {hasActivityContent(type) && (
            <section aria-label="Exploration instructions" className="space-y-3 rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">Goal: {definition?.description}</h2>
              <p className="text-sm text-muted-foreground">Start exploration to record when you begin this assigned exercise. Try a few examples or readings below, then use Finish exploration when you are done. Opening the page alone does not record participation.</p>
              {latest?.status === "completed" ? <p role="status">Completion saved. This records exploration participation, not a quiz score. You can review the exercise without starting again.</p>
                : latest ? <p>Your exploration is in progress. Continue below, then save your completion.</p> : null}
              {(!latest || latest.status === "completed") && <AttemptControls key={latest?.id ?? 'new'} assignmentId={assignmentId} attemptId={latest?.id} completed={latest?.status === 'completed'} />}
            </section>
          )}
          <section className="rounded-xl border border-border bg-card p-6">
            {hasActivityContent(type) && !latest ? (
              <p role="status" className="text-sm text-muted-foreground">
                Start exploration above to open this assigned exercise.
              </p>
            ) : (
              <>
                {explorer === "bohr" && <BohrModelViewer />}
                {explorer === "lewis-diagram" && <LewisDotExplorer />}
                {explorer === "ionic" && <IonicCompoundExplorer />}
                {explorer === "covalent" && <CovalentBondExplorer />}
                {explorer === "cylinder" && <MeasurementComparison instrument="cylinder" />}
                {explorer === "ruler" && <MeasurementComparison instrument="ruler" />}
              </>
            )}
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
          {hasActivityContent(type) && <AttemptHistory attempts={explorationAttempts} />}
          {explorer === "bohr" && <QuizAttemptHistory title="Bohr quiz" attempts={bohrQuizAttempts} />}
          {measurementQuizMode && (
            <>
              <section aria-label="Measurement quiz history" className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-xl font-semibold">Measurement quiz history</h2>
                {measurementAttempts.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No quiz attempts yet.</p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {measurementAttempts.map((attempt) => (
                      <li key={attempt.id} className="rounded-lg border border-border bg-muted p-3 text-sm">
                        <p className="font-medium">
                          {`${measurementAttemptLabel(attempt.instrument, attempt.precision_mode)} · Attempt ${attempt.attempt_number}`}
                        </p>
                        {attempt.status === "completed" ? (
                          <p className="mt-1">
                            {`${attempt.score ?? 0} of ${attempt.question_total ?? 0} correct · ${attempt.passed ? "Passed" : "Not passed"}`}
                            {attempt.completed_at && (
                              <> · completed <LocalizedTimestamp value={attempt.completed_at} /></>
                            )}
                          </p>
                        ) : (
                          <p className="mt-1">In progress</p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-4 text-xl font-semibold">Measurement quiz</h2>
                <MeasurementQuiz assignmentId={assignmentId} mode={measurementQuizMode.key} />
              </section>
            </>
          )}
        </AssignmentAccess>
        {quizKind && <LewisQuizCard kind={quizKind} assignmentId={assignmentId} assignments={result.assignments} />}
        {explorer === "bohr" && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Bohr Models Quiz</h2>
            <Link href={`/student/quizzes/bohr?assignmentId=${encodeURIComponent(assignmentId)}`} prefetch={false}
              className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
              Start quiz
            </Link>
          </section>
        )}
        {gate.status === "open" && gate.entry.complete && (
          <section aria-label="Next section" className="space-y-3 rounded-xl border border-border bg-card p-5">
            {gate.next ? (
              <>
                <p className="font-semibold">Section complete.</p>
                <Link href={assignmentPath(gate.next.assignment)} prefetch={false}
                  className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                  Continue to {gate.next.assignment.activity.title}
                </Link>
              </>
            ) : (
              <>
                <p className="font-semibold">You&apos;ve finished all open sections.</p>
                <Link href="/student" className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-semibold">
                  Back to assignments
                </Link>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
