"use client";

import RandomizedQuiz from "@/components/quiz/RandomizedQuiz";
import type { QuizCompleteResult } from "@/components/quiz/types";
import { BOHR_MODEL_QUESTIONS, BOHR_QUESTIONS_PER_ATTEMPT } from "./questions";

type BohrModelsQuizProps = {
  onComplete?: (result: QuizCompleteResult) => void;
};

export default function BohrModelsQuiz({ onComplete }: BohrModelsQuizProps) {
  return (
    <RandomizedQuiz
      title="Bohr Models Quiz"
      pool={BOHR_MODEL_QUESTIONS}
      questionsPerAttempt={BOHR_QUESTIONS_PER_ATTEMPT}
      passingThresholdPercent={80}
      onComplete={onComplete}
    />
  );
}
