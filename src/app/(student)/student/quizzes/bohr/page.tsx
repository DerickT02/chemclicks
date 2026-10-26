import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import LockedSection from "@/components/assignments/LockedSection";
import BohrModelsQuiz from "@/components/quiz/bohr/BohrModelsQuiz";
import { getBohrQuizAccess } from "@/lib/assignments/bohr-quiz-access";
import { assignmentPath } from "@/lib/assignments/sequence";
import { BOHR_QUIZ_KEY, listQuizQuestions, type QuizQuestionsResult } from "@/lib/db/quiz-questions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Bohr Models Quiz | ChemClicks",
  description:
    "Check your understanding of Bohr models, electron shells, and the nucleus.",
};
export const dynamic = "force-dynamic";

const LOAD_ERROR_MESSAGE =
  "We couldn't load the quiz questions. Please try again.";

type Props = {
  searchParams?: Promise<{ assignmentId?: string | string[] }>;
};

export default async function BohrModelQuizPage({ searchParams }: Props = {}) {
  const params = searchParams ? await searchParams : {};
  const rawAssignmentId = params.assignmentId;
  const assignmentId = Array.isArray(rawAssignmentId) ? rawAssignmentId[0] : rawAssignmentId;
  const access = await getBohrQuizAccess(assignmentId);
  if (access.status === "unauthenticated") redirect("/login/student");

  if (access.status !== "available") {
    return (
      <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-3xl font-semibold text-foreground">
            Bohr Models Quiz
          </h1>
          {access.status === "selection" ? (
            <div className="mt-6 space-y-3" role="status">
              <p className="text-muted-foreground">Choose the Bohr assignment you want to take.</p>
              <ul className="space-y-2" aria-label="Bohr assignments">
                {access.assignments.map((assignment) => (
                  <li key={assignment.id}>
                    <Link
                      href={`/student/quizzes/bohr?assignmentId=${encodeURIComponent(assignment.id)}`}
                      className="inline-flex rounded-md border border-border px-4 py-2 font-semibold text-foreground underline"
                    >
                      {assignment.activity.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : access.status === "blocked" ? (
            <div className="mt-6">
              <LockedSection blocker={access.blocker} />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <p role={access.status === "error" ? "alert" : "status"} className="text-muted-foreground">
                {access.status === "error"
                  ? access.message
                  : access.status === "missing"
                  ? "This Bohr assignment is missing or you no longer have access to it."
                  : access.status === "scheduled"
                  ? "This Bohr quiz is scheduled but is not open yet."
                  : access.status === "closed"
                  ? "This Bohr quiz is closed. Previously saved results remain available."
                  : "This quiz is locked until your teacher assigns a Bohr Models lesson."}
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
    questionsResult = await listQuizQuestions(createAdminClient(), BOHR_QUIZ_KEY);
  } catch {
    questionsResult = { data: null, error: { code: "unavailable", message: LOAD_ERROR_MESSAGE } };
  }

  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Bohr Models Quiz
          </h1>
        </header>

        <BohrModelsQuiz
          assignmentId={access.assignment.id}
          questions={questionsResult.error ? [] : questionsResult.data ?? []}
          loadError={questionsResult.error ? LOAD_ERROR_MESSAGE : null}
        />
      </div>
    </div>
  );
}
