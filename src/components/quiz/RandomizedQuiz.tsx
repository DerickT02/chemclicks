"use client";

import { useEffect, useState } from "react";
import QuizShell from "@/components/quiz/QuizShell";
import { pickRandomQuestions } from "@/components/quiz/random";
import type { QuizCompleteResult, QuizQuestion } from "@/components/quiz/types";

type RandomizedQuizProps = {
  title: string;
  pool: QuizQuestion[];
  questionsPerAttempt: number;
  passingThresholdPercent?: number;
  onComplete?: (result: QuizCompleteResult) => void;
};

export default function RandomizedQuiz({
  title,
  pool,
  questionsPerAttempt,
  passingThresholdPercent = 80,
  onComplete,
}: RandomizedQuizProps) {
  // Start empty so server and first client render match (no Math.random during SSR).
  const [attemptQuestions, setAttemptQuestions] = useState<QuizQuestion[]>(
    [],
  );

  useEffect(() => {
    // Deferred to satisfy react-hooks/set-state-in-effect.
    const timeoutId = window.setTimeout(() => {
      setAttemptQuestions(pickRandomQuestions(pool, questionsPerAttempt));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [pool, questionsPerAttempt]);

  if (attemptQuestions.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-card p-8 md:p-10">
        <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-base text-muted-foreground md:text-lg">
          Loading questions…
        </p>
      </article>
    );
  }

  return (
    <QuizShell
      title={title}
      questions={attemptQuestions}
      passingThresholdPercent={passingThresholdPercent}
      onComplete={onComplete}
      onRetry={() =>
        setAttemptQuestions(pickRandomQuestions(pool, questionsPerAttempt))
      }
    />
  );
}
