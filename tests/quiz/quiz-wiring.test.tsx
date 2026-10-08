import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/quiz/RandomizedQuiz", () => ({
  default: ({ assignmentId, quizKey }: { assignmentId?: string; quizKey?: string }) => (
    <output data-assignment-id={assignmentId} data-quiz-key={quizKey} />
  ),
}));

import BohrModelsQuiz from "@/components/quiz/bohr/BohrModelsQuiz";
import LewisQuiz from "@/components/quiz/lewis/LewisQuiz";
import type { QuizQuestion } from "@/components/quiz/types";

const questions: QuizQuestion[] = [
  {
    id: "q1",
    question: "Question?",
    options: ["A", "B"],
    answerOrder: [0, 1],
  },
];

describe("quiz submission wiring", () => {
  it("connects Bohr quizzes to the bohr_models server key", () => {
    const rendered = BohrModelsQuiz({ assignmentId: "assignment-bohr", questions });
    expect(rendered.props.assignmentId).toBe("assignment-bohr");
    expect(rendered.props.quizKey).toBe("bohr_models");
  });

  it.each([
    ["covalent", "lewis_covalent"],
    ["ionic", "lewis_ionic"],
  ])("connects %s quizzes to their server key", (kind, quizKey) => {
    const rendered = LewisQuiz({
      title: `${kind} quiz`,
      assignmentId: `assignment-${kind}`,
      quizKey,
      questions,
    });
    expect(rendered.props.assignmentId).toBe(`assignment-${kind}`);
    expect(rendered.props.quizKey).toBe(quizKey);
  });
});
