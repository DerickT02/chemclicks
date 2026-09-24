import type { QuizQuestion } from "@/components/quiz/types";

/** How many questions each student attempt draws from the pool. */
export const BOHR_QUESTIONS_PER_ATTEMPT = 12;

/** Fisher–Yates shuffle of array items (mutates `items`). */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }
  return items;
}

/** Shuffle answer choices so the correct option is not always in the same position. */
export function shuffleQuestionOptions(question: QuizQuestion): QuizQuestion {
  const entries = question.options.map((option, index) => ({
    option,
    isCorrect: index === question.correctIndex,
  }));
  shuffleInPlace(entries);

  return {
    ...question,
    options: entries.map((entry) => entry.option),
    correctIndex: entries.findIndex((entry) => entry.isCorrect),
  };
}

/** Fisher–Yates shuffle, then take the first `count` questions with shuffled options. */
export function pickRandomQuestions(
  pool: QuizQuestion[],
  count: number,
): QuizQuestion[] {
  const copy = shuffleInPlace([...pool]);
  return copy
    .slice(0, Math.min(count, copy.length))
    .map(shuffleQuestionOptions);
}
