"use client";

import RandomizedQuiz from "@/components/quiz/RandomizedQuiz";
import type { QuizCompleteResult, QuizQuestion } from "@/components/quiz/types";
import { BOHR_QUIZ_KEY } from "@/lib/db/quiz-questions";

/** How many questions each student attempt draws from the pool. */
const BOHR_QUESTIONS_PER_ATTEMPT = 12;

type BohrModelsQuizProps = {
  /** The full question pool, loaded from the database by the page. */
  questions: QuizQuestion[];
  loadError?: string | null;
  assignmentId?: string;
  title?: string;
  quizKey?: string;
  onComplete?: (result: QuizCompleteResult) => void;
};

export default function BohrModelsQuiz({
  questions,
  loadError,
  assignmentId,
  title = "Bohr Models Quiz",
  quizKey = BOHR_QUIZ_KEY,
  onComplete,
}: BohrModelsQuizProps) {
  return (
    <RandomizedQuiz
      title={title}
      pool={questions}
      questionsPerAttempt={BOHR_QUESTIONS_PER_ATTEMPT}
      passingThresholdPercent={80}
      loadError={loadError}
      assignmentId={assignmentId}
      quizKey={quizKey}
      onComplete={onComplete}
    />
  );
}
