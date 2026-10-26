import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuizQuestion } from "@/components/quiz/types";
import { COVALENT_COMPOUNDS } from "@/lib/chemistry/covalent-compounds";

// Logic and types regarding the QUIZ_QUESTIONS table.

export const BOHR_QUIZ_KEY = "bohr_models";
export const LEWIS_COVALENT_QUIZ_KEY = "lewis_covalent";
export const LEWIS_IONIC_QUIZ_KEY = "lewis_ionic";

type QuizQuestionRow = {
  question_key: string;
  question: string;
  options: unknown;
  correct_index: number;
  diagram_key?: unknown;
};

type QuizQuestionsError = {
  code: string;
  message: string;
};

export type QuizQuestionsResult = {
  data: QuizQuestion[] | null;
  error: QuizQuestionsError | null;
};

function isChoiceList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((choice) => typeof choice === "string")
  );
}

const COVALENT_DIAGRAM_KEYS = new Set(COVALENT_COMPOUNDS.map((compound) => compound.id));

function isCovalentDiagramKey(value: unknown): value is string {
  return typeof value === "string" && COVALENT_DIAGRAM_KEYS.has(value);
}

function toQuizQuestion(row: QuizQuestionRow): QuizQuestion | null {
  if (!isChoiceList(row.options)) return null;
  if (
    !Number.isInteger(row.correct_index) ||
    row.correct_index < 0 ||
    row.correct_index >= row.options.length
  ) {
    return null;
  }
  if (row.diagram_key !== undefined && row.diagram_key !== null && !isCovalentDiagramKey(row.diagram_key)) {
    return null;
  }

  return {
    id: row.question_key,
    question: row.question,
    options: row.options,
    ...(row.diagram_key ? { diagramKey: row.diagram_key } : {}),
    answerOrder: row.options.map((_, index) => index),
  };
}

/**
 * Lists the active questions for one quiz in their authored order. RLS limits
 * this to signed-in users; the explicit is_active filter documents the intent.
 * A malformed row fails the whole read instead of silently shrinking the quiz.
 */
export async function listQuizQuestions(
  supabase: SupabaseClient,
  quizKey: string,
): Promise<QuizQuestionsResult> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("question_key, question, options, correct_index, diagram_key")
    .eq("quiz_key", quizKey)
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .order("question_key", { ascending: true });

  if (error) return { data: null, error };

  const questions: QuizQuestion[] = [];
  for (const row of (data ?? []) as QuizQuestionRow[]) {
    const question = toQuizQuestion(row);
    if (!question) {
      return {
        data: null,
        error: {
          code: "invalid_quiz_question",
          message: `Quiz question "${row.question_key}" is malformed.`,
        },
      };
    }
    questions.push(question);
  }

  return { data: questions, error: null };
}
