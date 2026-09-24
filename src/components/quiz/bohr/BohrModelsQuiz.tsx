"use client";

import { useEffect, useState } from "react";
import QuizShell from "@/components/quiz/QuizShell";
import type { QuizCompleteResult, QuizQuestion } from "@/components/quiz/types";
import { BOHR_QUESTIONS_PER_ATTEMPT, pickRandomQuestions } from "./attempt";

type BohrModelsQuizProps = {
  /** The full question pool, loaded from the database by the page. */
  questions: QuizQuestion[];
  onComplete?: (result: QuizCompleteResult) => void;
};

function createAttemptQuestions(pool: QuizQuestion[]): QuizQuestion[] {
  return pickRandomQuestions(pool, BOHR_QUESTIONS_PER_ATTEMPT);
}

export default function BohrModelsQuiz({
  questions,
  onComplete,
}: BohrModelsQuizProps) {
  // Start empty so server and first client render match (no Math.random during SSR).
  const [attemptQuestions, setAttemptQuestions] = useState<QuizQuestion[]>(
    [],
  );

  useEffect(() => {
    // Defer so this is not a synchronous setState-in-effect lint violation,
    // and so hydration completes before the random attempt is drawn.
    const timeoutId = window.setTimeout(() => {
      setAttemptQuestions(createAttemptQuestions(questions));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [questions]);

  if (attemptQuestions.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-card p-8 md:p-10">
        <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
          Bohr Models Quiz
        </h2>
        <p className="mt-3 text-base text-muted-foreground md:text-lg">
          Loading questions…
        </p>
      </article>
    );
  }

  return (
    <QuizShell
      title="Bohr Models Quiz"
      questions={attemptQuestions}
      passingThresholdPercent={80}
      onComplete={onComplete}
      onRetry={() => setAttemptQuestions(createAttemptQuestions(questions))}
    />
  );
}
