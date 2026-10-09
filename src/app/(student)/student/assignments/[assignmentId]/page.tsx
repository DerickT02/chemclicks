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
import MeasurementQuiz from "@/components/measurement/MeasurementQuiz";

import { hasActivityContent } from "@/lib/assignments/activity-content";
import { lewisQuizForLesson } from "@/lib/assignments/lewis-quizzes";
import { measurementQuizModeForActivity } from "@/lib/measurement/modes";

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
  const measurementQuizMode = measurementQuizModeForActivity(type);
  const attempts = hasActivityContent(type) ? await getAssignmentAttempts(assignmentId) : [];
  const explorationAttempts = attempts.filter((attempt) => attempt.quiz_key === null);
  const measurementAttempts = attempts.filter((attempt) => attempt.instrument !== null && attempt.instrument !== undefined);
  const latest = explorationAttempts[0];
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
              <p className="mt-3 text-sm text-muted-foreground">{explorationAttempts.length} attempts. Completion records exploration participation, not a quiz score.</p>
              <ul className="mt-3 space-y-2 text-sm">
                {explorationAttempts.map(attempt => <li key={attempt.id}>
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
            {type === "measurement_graduated_cylinder" && <GraduatedCylinder />}
            {(type === "measurement_ruler_tenths" || type === "measurement_ruler_hundredths") && <PrecisionRuler />}
            {!hasActivityContent(type) && (
              <p className="text-muted-foreground">This activity’s exercise is not available yet.</p>
            )}
          </section>
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
                          {`${attempt.instrument === "cylinder" ? "Graduated cylinder" : "Ruler"} · ${attempt.precision_mode === "hundredths" ? "hundredths" : "tenths"} · Attempt ${attempt.attempt_number}`}
                        </p>
                        {attempt.status === "completed" ? (
                          <p className="mt-1">
                            {`${attempt.score ?? 0} of ${attempt.question_total ?? 0} correct · ${attempt.passed ? "Passed" : "Not passed"}`}
                            {attempt.completed_at && (
                              <> · completed <time dateTime={attempt.completed_at}>{new Date(attempt.completed_at).toLocaleString("en-US", { timeZone: "UTC" })} UTC</time></>
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
        {quizKind && <LewisQuizCard kind={quizKind} assignments={result.assignments} />}
      </div>
    </main>
  );
}
