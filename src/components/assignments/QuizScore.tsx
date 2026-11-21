import type { AssignmentProgressFacts } from "@/lib/assignments/progress";

type Props = { facts: AssignmentProgressFacts };

function attempts(count: number): string {
  return `${count} ${count === 1 ? "attempt" : "attempts"}`;
}

/** The saved passing result, never the assignment's completion percentage. */
export function QuizScore({ facts }: Props) {
  const failed = facts.failedQuizAttemptCount;
  if (facts.passingQuizAttemptNumber !== null) {
    const score = facts.passingQuizScore !== null && facts.passingQuizTotal !== null
      ? `: ${facts.passingQuizScore}/${facts.passingQuizTotal}` : "";
    const percent = facts.passingQuizPercentage !== null ? ` (${facts.passingQuizPercentage}%)` : "";
    return <>Passed on attempt {facts.passingQuizAttemptNumber}{score}{percent}</>;
  }
  if (facts.stage === "quiz_in_progress") {
    return <>In progress{failed > 0 ? ` · ${attempts(failed)} not passed` : ""}</>;
  }
  if (failed > 0) return <>Not passed yet · {attempts(failed)} submitted</>;
  return <>Not started</>;
}
