import Link from "next/link";
import { redirect } from "next/navigation";
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
import LewisQuiz from "@/components/quiz/lewis/LewisQuiz";
import { getLewisQuizAccess } from "@/lib/assignments/lewis-quiz-access";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";
import { listQuizQuestions } from "@/lib/db/quiz-questions";
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
  const { data: questions, error } =
    access.status === "available"
      ? await listQuizQuestions(createAdminClient(), quizKey)
      : { data: null, error: null };

  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Complete this quiz before moving on to the next section.
          </p>
        </header>

        {access.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {access.message}
          </p>
        ) : access.status === "locked" ? (
          <div
            role="status"
            className="space-y-3 rounded-lg border border-dashed border-border p-6"
          >
            <p className="font-semibold text-foreground">This quiz is locked.</p>
            <p className="text-muted-foreground">
              Your teacher must assign the {lessonTitle} lesson to your class
              before you can take this quiz.
            </p>
            <Link href="/student" className="text-accent underline">
              Back to assignments
            </Link>
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {LOAD_ERROR_MESSAGE}
          </p>
        ) : !questions || questions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
            No quiz questions are available right now.
          </p>
        ) : (
          <AssignmentAccess
            key={`${access.assignment.id}:${access.assignment.closes_at}`}
            closesAt={access.assignment.closes_at}
          >
          <LewisQuiz
            title={title}
            assignmentId={access.assignment.id}
            quizKey={quizKey}
            questions={questions}
          />
          </AssignmentAccess>
        )}
      </div>
    </div>
  );
}
