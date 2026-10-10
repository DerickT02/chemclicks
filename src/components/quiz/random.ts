import type { QuizQuestion } from "@/components/quiz/types";

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
    originalIndex: question.answerOrder?.[index] ?? index,
  }));
  shuffleInPlace(entries);

  return {
    ...question,
    options: entries.map((entry) => entry.option),
    answerOrder: entries.map((entry) => entry.originalIndex),
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
