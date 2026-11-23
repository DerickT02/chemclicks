import Link from "next/link";
import { redirect } from "next/navigation";
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
import LewisQuiz from "@/components/quiz/lewis/LewisQuiz";
import { getLewisQuizAccess } from "@/lib/assignments/lewis-quiz-access";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";
import { assignmentPath } from "@/lib/assignments/sequence";
import { listQuizQuestions, type QuizQuestionsResult } from "@/lib/db/quiz-questions";
import { createAdminClient } from "@/lib/supabase/admin";

type Props = {
  kind: LewisQuizKind;
  /** The lesson assignment the quiz was opened from, when known. */
  assignmentId?: string;
};

const LOAD_ERROR_MESSAGE =
  "We couldn't load the quiz questions. Please try again.";

export default async function LewisQuizPage({ kind, assignmentId }: Props) {
  const { title, quizKey, lessonTitle, path } = LEWIS_QUIZZES[kind];
  // Access comes from the student's own class assignment, checked per request.
  const access = await getLewisQuizAccess(kind, assignmentId);
  if (access.status === "unauthenticated") redirect("/login/student");
  // No lesson for this quiz is assigned: there is nothing to take here.
  if (access.status === "locked") redirect("/student");

  if (access.status !== "available") {
    return (
      <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          {access.status === "selection" ? (
            <div className="mt-6 space-y-3" role="status">
              <p className="text-muted-foreground">
                Choose the {lessonTitle} assignment you want to take.
              </p>
              <ul className="space-y-2" aria-label={`${lessonTitle} assignments`}>
                {access.assignments.map((assignment) => (
                  <li key={assignment.id}>
                    <Link
                      href={`${path}?assignmentId=${encodeURIComponent(assignment.id)}`}
                      className="inline-flex rounded-md border border-border px-4 py-2 font-semibold text-foreground underline"
                    >
                      {assignment.activity.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <p
                role={access.status === "error" ? "alert" : "status"}
                className="text-muted-foreground"
              >
                {access.status === "error"
                  ? access.message
                  : access.status === "missing"
                    ? `This ${lessonTitle} assignment is missing or you no longer have access to it.`
                    : access.status === "scheduled"
                      ? `Your ${lessonTitle} lesson is scheduled. Return when the assignment opens.`
                      : `Your ${lessonTitle} lesson is no longer open. Further quiz answers are unavailable; quizzes you already finished remain saved.`}
              </p>
              <div className="flex flex-wrap gap-3">
                {(access.status === "scheduled" || access.status === "closed") && (
                  <Link href={assignmentPath(access.assignment)} className="text-accent underline">
                    Back to {access.assignment.activity.title}
                  </Link>
                )}
                <Link href="/student" className="text-accent underline">
                  Back to assignments
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Client sessions cannot read these rows; load them only after access passes.
  let questionsResult: QuizQuestionsResult;
  try {
    questionsResult = await listQuizQuestions(createAdminClient(), quizKey);
  } catch {
    questionsResult = { data: null, error: { code: "unavailable", message: LOAD_ERROR_MESSAGE } };
  }

  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        </header>

        <AssignmentAccess
          key={access.assignment.id}
          closesAt={access.assignment.closes_at}
          contentType="quiz"
        >
          <LewisQuiz
            title={title}
            assignmentId={access.assignment.id}
            quizKey={quizKey}
            questions={questionsResult.error ? [] : questionsResult.data ?? []}
            loadError={questionsResult.error ? LOAD_ERROR_MESSAGE : null}
          />
        </AssignmentAccess>
      </div>
    </div>
  );
}
