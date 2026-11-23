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
      ? `${facts.passingQuizScore}/${facts.passingQuizTotal}` : null;
    const percent = facts.passingQuizPercentage !== null ? ` (${facts.passingQuizPercentage}%)` : "";
    return score !== null
      ? <>Quiz score: {score}{percent} · Passed on attempt {facts.passingQuizAttemptNumber}</>
      : <>Quiz passed on attempt {facts.passingQuizAttemptNumber}{percent}</>;
  }
  if (facts.stage === "quiz_in_progress") {
    return <>Quiz in progress{failed > 0 ? ` · ${attempts(failed)} not passed` : ""}</>;
  }
  if (failed > 0) return <>{failed} quiz {failed === 1 ? "attempt" : "attempts"} submitted</>;
  // The status already says "Not started"; repeating it for the quiz adds nothing.
  if (facts.stage === "not_started") return null;
  return <>Quiz not started</>;
}
