import { notFound } from "next/navigation";
import BohrModelsQuiz from "@/components/quiz/bohr/BohrModelsQuiz";
import LewisQuiz from "@/components/quiz/lewis/LewisQuiz";
import {
  BOHR_QUIZ_KEY,
  LEWIS_COVALENT_QUIZ_KEY,
  LEWIS_IONIC_QUIZ_KEY,
  listQuizQuestions,
} from "@/lib/db/quiz-questions";
import { createAdminClient } from "@/lib/supabase/admin";

// TEMPORARY: development-only quiz preview without a student session. Delete before merging.
const QUIZZES = {
  bohr: { title: "Bohr Models Quiz", quizKey: BOHR_QUIZ_KEY },
  "lewis-covalent": { title: "Covalent Compounds Quiz", quizKey: LEWIS_COVALENT_QUIZ_KEY },
  "lewis-ionic": { title: "Ionic Compounds Quiz", quizKey: LEWIS_IONIC_QUIZ_KEY },
};

export default async function DevQuizPreviewPage({ params }: {
  params: Promise<{ quiz: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { quiz } = await params;
  const entry = QUIZZES[quiz as keyof typeof QUIZZES];
  if (!entry) notFound();

  const { title, quizKey } = entry;
  const { data: questions } = await listQuizQuestions(createAdminClient(), quizKey);

  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Development preview — no student session required.
          </p>
        </header>

        {!questions || questions.length === 0 ? (
          <p className="text-muted-foreground">No questions found for {quizKey}.</p>
        ) : quiz === "bohr" ? (
          <BohrModelsQuiz questions={questions} />
        ) : (
          <LewisQuiz title={title} questions={questions} />
        )}
      </div>
    </div>
  );
}
