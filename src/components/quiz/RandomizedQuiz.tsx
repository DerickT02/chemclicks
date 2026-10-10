"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QuizShell from "@/components/quiz/QuizShell";
import { pickRandomQuestions } from "@/components/quiz/random";
import type { QuizCompleteResult, QuizQuestion } from "@/components/quiz/types";

type RandomizedQuizProps = {
  title: string;
  pool: QuizQuestion[];
  questionsPerAttempt: number;
  passingThresholdPercent?: number;
  loadError?: string | null;
  onComplete?: (result: QuizCompleteResult) => void;
};

type AttemptSnapshot = {
  questions: QuizQuestion[];
  passingThresholdPercent: number;
};

export default function RandomizedQuiz({
  title,
  pool,
  questionsPerAttempt,
  passingThresholdPercent = 80,
  loadError = null,
  onComplete,
}: RandomizedQuizProps) {
  // No randomness during SSR/hydration. Once drawn, this snapshot belongs to
  // the attempt, not the latest server response. Only an explicit retry clears it.
  const [attempt, setAttempt] = useState<AttemptSnapshot | null>(null);
  const validCount = Number.isInteger(questionsPerAttempt) && questionsPerAttempt > 0;

  useEffect(() => {
    if (attempt || loadError || pool.length === 0 || !validCount) return;
    const timeoutId = window.setTimeout(() => {
      setAttempt({
        questions: pickRandomQuestions(pool, questionsPerAttempt),
        passingThresholdPercent,
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [attempt, pool, questionsPerAttempt, passingThresholdPercent, loadError, validCount]);

  if (attempt) {
    return (
      <>
        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            Updated quiz questions could not be loaded. Your current attempt is unchanged.
            A new attempt needs a successful question load.
          </p>
        )}
        <QuizShell
          title={title}
          questions={attempt.questions}
          passingThresholdPercent={attempt.passingThresholdPercent}
          onComplete={onComplete}
          onRetry={() => setAttempt(null)}
        />
      </>
    );
  }

  const unavailable = Boolean(loadError) || pool.length === 0 || !validCount;
  return (
    <article className="rounded-2xl border border-border bg-card p-8 md:p-10">
      <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
        {title}
      </h2>
      <p role={loadError || !validCount ? "alert" : "status"}
        className="mt-3 text-base text-muted-foreground md:text-lg">
        {loadError ?? (!validCount
          ? "This quiz could not be started. Please return to assignments and try again."
          : pool.length === 0 ? "No quiz questions are available right now." : "Loading questions…")}
      </p>
      {unavailable && (
        <Link href="/student" className="mt-4 inline-flex text-foreground underline">
          Back to assignments
        </Link>
      )}
    </article>
  );
}
