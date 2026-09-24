"use client";

import RandomizedQuiz from "@/components/quiz/RandomizedQuiz";
import type { QuizCompleteResult } from "@/components/quiz/types";
import {
  LEWIS_BONDING_QUESTIONS,
  LEWIS_QUESTIONS_PER_ATTEMPT,
} from "./questions";

type LewisBondingQuizProps = {
  onComplete?: (result: QuizCompleteResult) => void;
};

export default function LewisBondingQuiz({ onComplete }: LewisBondingQuizProps) {
  return (
    <RandomizedQuiz
      title="Lewis Structures & Bonding Quiz"
      pool={LEWIS_BONDING_QUESTIONS}
      questionsPerAttempt={LEWIS_QUESTIONS_PER_ATTEMPT}
      passingThresholdPercent={80}
      onComplete={onComplete}
    />
  );
}
