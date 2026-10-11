import Link from "next/link";
import { redirect } from "next/navigation";
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
import LewisQuiz from "@/components/quiz/lewis/LewisQuiz";
import { getLewisQuizAccess } from "@/lib/assignments/lewis-quiz-access";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";
import { listQuizQuestions, type QuizQuestionsResult } from "@/lib/db/quiz-questions";
import { createAdminClient } from "@/lib/supabase/admin";

type Props = { kind: LewisQuizKind };

const LOAD_ERROR_MESSAGE =
  "We couldn't load the quiz questions. Please try again.";

export default async function LewisQuizPage({ kind }: Props) {
  const { title, quizKey, lessonTitle } = LEWIS_QUIZZES[kind];
  // Access comes from the student's own class assignment, checked per request.
  const access = await getLewisQuizAccess(kind);
  if (access.status === "unauthenticated") redirect("/login/student");

  // Client sessions cannot read these rows; load them only after access passes.
  let questionsResult: QuizQuestionsResult = { data: null, error: null };
  if (access.status === "available") {
    try {
      questionsResult = await listQuizQuestions(createAdminClient(), quizKey);
    } catch {
      questionsResult = { data: null, error: { code: "unavailable", message: LOAD_ERROR_MESSAGE } };
    }
  }

  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link href="/student" className="text-sm text-foreground underline">Back to assignments</Link>
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Check your understanding. Your score is saved for your teacher when you finish.
          </p>
        </header>

        {access.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {access.message}
          </p>
        ) : access.status !== "available" ? (
          <div
            role="status"
            className="space-y-3 rounded-lg border border-dashed border-border p-6"
          >
            <p className="font-semibold text-foreground">
              {access.status === "scheduled" ? "This quiz is not open yet."
                : access.status === "closed" ? "This quiz is closed."
                : "This quiz is locked."}
            </p>
            <p className="text-muted-foreground">
              {access.status === "scheduled"
                ? `Your ${lessonTitle} lesson is scheduled. Return when the assignment opens.`
                : access.status === "closed"
                ? `Your ${lessonTitle} lesson is no longer open. Further quiz answers are unavailable; quizzes you already finished remain saved.`
                : `Your teacher must assign the ${lessonTitle} lesson to your class before you can take this quiz.`}
            </p>
            <Link href="/student" className="text-accent underline">
              Back to assignments
            </Link>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
