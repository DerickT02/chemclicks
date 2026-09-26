"use client";

import RandomizedQuiz from "@/components/quiz/RandomizedQuiz";
import type { QuizCompleteResult, QuizQuestion } from "@/components/quiz/types";

/** How many questions each student attempt draws from the pool. */
const LEWIS_QUESTIONS_PER_ATTEMPT = 12;

type LewisBondingQuizProps = {
  /** The full question pool, loaded from the database by the page. */
  questions: QuizQuestion[];
  onComplete?: (result: QuizCompleteResult) => void;
};

export default function LewisBondingQuiz({
  questions,
  onComplete,
}: LewisBondingQuizProps) {
  return (
    <RandomizedQuiz
      title="Lewis Structures & Bonding Quiz"
      pool={questions}
      questionsPerAttempt={LEWIS_QUESTIONS_PER_ATTEMPT}
      passingThresholdPercent={80}
      onComplete={onComplete}
    />
  );
}
