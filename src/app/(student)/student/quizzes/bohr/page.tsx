import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import BohrModelsQuiz from "@/components/quiz/bohr/BohrModelsQuiz";
import { getBohrQuizAccess } from "@/lib/assignments/bohr-quiz-access";
import { BOHR_QUIZ_KEY, listQuizQuestions, type QuizQuestionsResult } from "@/lib/db/quiz-questions";
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
  let questionsResult: QuizQuestionsResult;
  try {
    questionsResult = await listQuizQuestions(supabase, BOHR_QUIZ_KEY);
  } catch {
    questionsResult = { data: null, error: { code: "unavailable", message: LOAD_ERROR_MESSAGE } };
  }

  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link href="/student/labs/bohr-models" className="text-sm text-foreground underline">Back to practice lesson</Link>
          <h1 className="text-3xl font-semibold text-foreground">
            Bohr Models Quiz
          </h1>
          <p className="text-sm text-muted-foreground">
            Check your understanding. Your score is saved for your teacher when you finish.
          </p>
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
