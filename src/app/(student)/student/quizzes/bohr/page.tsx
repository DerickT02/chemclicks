import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BohrModelsQuiz from "@/components/quiz/bohr/BohrModelsQuiz";
import { getBohrQuizAccess } from "@/lib/assignments/bohr-quiz-access";
import { BOHR_QUIZ_KEY, listQuizQuestions } from "@/lib/db/quiz-questions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Bohr Models Quiz | ChemClicks",
  description:
    "Check your understanding of Bohr models, electron shells, and the nucleus.",
};
export const dynamic = "force-dynamic";

const LOAD_ERROR_MESSAGE =
  "We couldn't load the quiz questions. Please try again.";

export default async function BohrModelQuizPage() {
  const access = await getBohrQuizAccess();
  if (access.status === "unauthenticated") redirect("/login/student");

  if (access.status !== "available") {
    return (
      <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-3xl font-semibold text-foreground">
            Bohr Models Quiz
          </h1>
          <p role={access.status === "error" ? "alert" : "status"} className="mt-6 text-muted-foreground">
            {access.status === "error"
              ? access.message
              : "This quiz is locked until your teacher assigns a Bohr Models lesson."}
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: questions, error } = await listQuizQuestions(
    supabase,
    BOHR_QUIZ_KEY,
  );

  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Bohr Models Quiz
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete this quiz before moving on to the next section.
          </p>
        </header>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {LOAD_ERROR_MESSAGE}
          </p>
        ) : !questions || questions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
            No quiz questions are available right now.
          </p>
        ) : (
          <BohrModelsQuiz
            assignmentId={access.assignment.id}
            questions={questions}
          />
        )}
      </div>
    </div>
  );
}
