import type { ActivityType } from "@/lib/db/activities";
import { LEWIS_COVALENT_QUIZ_KEY, LEWIS_IONIC_QUIZ_KEY } from "@/lib/db/quiz-questions";

export type LewisQuizKind = "covalent" | "ionic";

export type LewisQuizConfig = {
  /** Assigning this lesson to a class unlocks the quiz for that class. */
  lessonType: ActivityType;
  lessonTitle: string;
  quizKey: string;
  path: string;
  title: string;
};

export const LEWIS_QUIZZES: Record<LewisQuizKind, LewisQuizConfig> = {
  covalent: {
    lessonType: "lewis_structures_covalent",
    lessonTitle: "Lewis Structures — Covalent",
    quizKey: LEWIS_COVALENT_QUIZ_KEY,
    path: "/student/quizzes/covalent",
    title: "Covalent Compounds Quiz",
  },
  ionic: {
    lessonType: "lewis_structures_ionic",
    lessonTitle: "Lewis Structures — Ionic",
    quizKey: LEWIS_IONIC_QUIZ_KEY,
    path: "/student/quizzes/ionic",
    title: "Ionic Compounds Quiz",
  },
};

export function lewisQuizForLesson(type: ActivityType): LewisQuizKind | null {
  const kinds = Object.keys(LEWIS_QUIZZES) as LewisQuizKind[];
  return kinds.find((kind) => LEWIS_QUIZZES[kind].lessonType === type) ?? null;
}
