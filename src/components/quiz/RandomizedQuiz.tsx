"use client";

import { useEffect, useState } from "react";
import { submitQuizAction } from "@/app/(student)/student/quizzes/actions";
import QuizShell from "@/components/quiz/QuizShell";
import { pickRandomQuestions } from "@/components/quiz/random";
import type {
  QuizCompleteResult,
  QuizQuestion,
  QuizAnswer,
} from "@/components/quiz/types";

type RandomizedQuizProps = {
  title: string;
  pool: QuizQuestion[];
  questionsPerAttempt: number;
  passingThresholdPercent?: number;
  onComplete?: (result: QuizCompleteResult) => void;
  assignmentId?: string;
  quizKey?: string;
};

export default function RandomizedQuiz({
  title,
  pool,
  questionsPerAttempt,
  passingThresholdPercent = 80,
  onComplete,
  assignmentId,
  quizKey,
}: RandomizedQuizProps) {
  // Start empty so server and first client render match (no Math.random during SSR).
  const [attemptQuestions, setAttemptQuestions] = useState<QuizQuestion[]>(
    [],
  );
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);

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

  async function submitAnswers(answers: QuizAnswer[]): Promise<QuizCompleteResult> {
    if (!assignmentId || !quizKey) {
      throw new Error("This quiz is not linked to an assignment.");
    }

    const key = submissionKey
      ?? window.crypto.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!submissionKey) setSubmissionKey(key);

    return submitQuizAction({
      assignmentId,
      quizKey,
      submissionKey: key,
      answers,
    });
  }

  function retryQuiz() {
    setSubmissionKey(null);
    setAttemptQuestions(pickRandomQuestions(pool, questionsPerAttempt));
  }

  return (
    <QuizShell
      title={title}
      questions={attemptQuestions}
      passingThresholdPercent={passingThresholdPercent}
      onComplete={onComplete}
      onSubmit={assignmentId && quizKey ? submitAnswers : undefined}
      onRetry={retryQuiz}
    />
  );
}
