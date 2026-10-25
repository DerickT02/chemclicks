"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { startQuizAction, submitQuizAction } from "@/app/(student)/student/quizzes/actions";
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
  loadError?: string | null;
  onComplete?: (result: QuizCompleteResult) => void;
  assignmentId?: string;
  quizKey?: string;
};

type AttemptSnapshot = {
  questions: QuizQuestion[];
  passingThresholdPercent: number;
  startedAt: string | null;
};

export default function RandomizedQuiz({
  title,
  pool,
  questionsPerAttempt,
  passingThresholdPercent = 80,
  loadError = null,
  onComplete,
  assignmentId,
  quizKey,
}: RandomizedQuizProps) {
  // No randomness during SSR/hydration. Once drawn, this snapshot belongs to
  // the attempt, not the latest server response. Only an explicit retry clears it.
  const [attempt, setAttempt] = useState<AttemptSnapshot | null>(null);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [retryRequired, setRetryRequired] = useState(false);
  const [retryRequested, setRetryRequested] = useState(false);
  const [starting, setStarting] = useState(false);
  const validCount = Number.isInteger(questionsPerAttempt) && questionsPerAttempt > 0;

  useEffect(() => {
    if (attempt || retryRequired || loadError || pool.length === 0 || !validCount) return;
    const timeoutId = window.setTimeout(async () => {
      const isAssignmentQuiz = Boolean(assignmentId && quizKey);
      if (isAssignmentQuiz) setStarting(true);
      let startedAt: string | null = null;
      if (assignmentId && quizKey) {
        try {
          const result = await startQuizAction(assignmentId, quizKey, retryRequested);
          if (result.status === "retry_required") {
            setRetryRequired(true);
            setRetryRequested(false);
            return;
          }
          startedAt = result.startedAt;
          setStartError(null);
        } catch (error) {
          setStartError(error instanceof Error ? error.message : "The quiz could not be started. Please try again.");
          return;
        } finally {
          setStarting(false);
        }
      }
      const nextAttempt = {
        questions: pickRandomQuestions(pool, questionsPerAttempt),
        passingThresholdPercent,
        startedAt,
      };
      setRetryRequested(false);
      setStarting(false);
      setAttempt(nextAttempt);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [attempt, retryRequired, pool, questionsPerAttempt, passingThresholdPercent, loadError, validCount, assignmentId, quizKey, retryRequested]);

  async function submitAnswers(answers: QuizAnswer[]): Promise<QuizCompleteResult> {
    if (!assignmentId || !quizKey || !attempt?.startedAt) {
      throw new Error("This quiz is not linked to an assignment.");
    }

    const key = submissionKey
      ?? window.crypto.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!submissionKey) setSubmissionKey(key);

    return submitQuizAction({
      assignmentId,
      quizKey,
      startedAt: attempt.startedAt,
      submissionKey: key,
      answers,
    });
  }

  function retryQuiz() {
    setSubmissionKey(null);
    setStartError(null);
    setRetryRequired(false);
    setRetryRequested(true);
    setAttempt(null);
  }

  if (retryRequired) {
    return (
      <article className="rounded-2xl border border-border bg-card p-8 md:p-10">
        <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-base text-muted-foreground md:text-lg" role="status">
          You have a saved attempt for this quiz. Choose Try again to start another attempt.
        </p>
        <button
          type="button"
          onClick={retryQuiz}
          disabled={starting}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {starting ? "Starting…" : "Try again"}
        </button>
      </article>
    );
  }

  if (attempt) {
    return (
      <>
        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            Updated quiz questions could not be loaded. Your current attempt is unchanged.
            A new attempt needs a successful question load.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Taking quiz for this assignment.
        </p>
        <QuizShell
          title={title}
          questions={attempt.questions}
          passingThresholdPercent={attempt.passingThresholdPercent}
          onComplete={onComplete}
          onSubmit={assignmentId && quizKey ? submitAnswers : undefined}
          onRetry={retryQuiz}
        />
      </>
    );
  }

  const unavailable = Boolean(loadError) || Boolean(startError) || pool.length === 0 || !validCount;
  return (
    <article className="rounded-2xl border border-border bg-card p-8 md:p-10">
      <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
        {title}
      </h2>
      <p role={loadError || startError || !validCount ? "alert" : "status"}
        className="mt-3 text-base text-muted-foreground md:text-lg">
        {loadError ?? startError ?? (!validCount
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
