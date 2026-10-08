"use client";

import RandomizedQuiz from "@/components/quiz/RandomizedQuiz";
import type { QuizCompleteResult, QuizQuestion } from "@/components/quiz/types";

/** How many questions each student attempt draws from the pool. */
const LEWIS_QUESTIONS_PER_ATTEMPT = 12;

type LewisQuizProps = {
  title: string;
  assignmentId?: string;
  quizKey?: string;
  /** The full question pool, loaded from the database by the page. */
  questions: QuizQuestion[];
  onComplete?: (result: QuizCompleteResult) => void;
};

export default function LewisQuiz({
  title,
  assignmentId,
  quizKey,
  questions,
  onComplete,
}: LewisQuizProps) {
  return (
    <RandomizedQuiz
      title={title}
      pool={questions}
      questionsPerAttempt={LEWIS_QUESTIONS_PER_ATTEMPT}
      passingThresholdPercent={80}
      assignmentId={assignmentId}
      quizKey={quizKey}
      onComplete={onComplete}
    />
  );
}
