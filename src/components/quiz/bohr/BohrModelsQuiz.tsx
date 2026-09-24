"use client";

import RandomizedQuiz from "@/components/quiz/RandomizedQuiz";
import type { QuizCompleteResult, QuizQuestion } from "@/components/quiz/types";

/** How many questions each student attempt draws from the pool. */
const BOHR_QUESTIONS_PER_ATTEMPT = 12;

type BohrModelsQuizProps = {
  /** The full question pool, loaded from the database by the page. */
  questions: QuizQuestion[];
  onComplete?: (result: QuizCompleteResult) => void;
};

export default function BohrModelsQuiz({
  questions,
  onComplete,
}: BohrModelsQuizProps) {
  return (
    <RandomizedQuiz
      title="Bohr Models Quiz"
      pool={questions}
      questionsPerAttempt={BOHR_QUESTIONS_PER_ATTEMPT}
      passingThresholdPercent={80}
      onComplete={onComplete}
    />
  );
}
