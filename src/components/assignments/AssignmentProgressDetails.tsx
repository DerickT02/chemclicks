import type { ReactNode } from "react";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import type { AssignmentProgressFacts } from "@/lib/assignments/progress";
import { formatDuration, hasReachedQuiz } from "@/lib/assignments/stages";

type Props = { facts: AssignmentProgressFacts; className?: string };

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-medium text-foreground/80">{term}:</dt>
      <dd>{children}</dd>
    </div>
  );
}

function attempts(count: number): string {
  return `${count} ${count === 1 ? "attempt" : "attempts"}`;
}

function QuizResult({ facts }: { facts: AssignmentProgressFacts }) {
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

// Exploration time is the saved first-exploration-start to first-quiz-start
// interval; quiz-taking time is never added to it. Missing history reads as
// "not recorded" rather than a guessed value.
export function AssignmentProgressDetails({ facts, className }: Props) {
  const quizReached = hasReachedQuiz(facts.stage) || facts.firstQuizStartedAt !== null
    || facts.passingQuizAttemptNumber !== null || facts.failedQuizAttemptCount > 0;

  return (
    <dl className={className ?? "space-y-1 text-sm text-muted-foreground"}>
      <Row term="Exploration started">
        {facts.stage === "not_started" ? "Not started"
          : facts.explorationStartedAt ? <LocalizedTimestamp value={facts.explorationStartedAt} />
            : "Start time not recorded"}
      </Row>
      {facts.stage !== "not_started" && (
        <Row term="Exploration to first quiz">
          {facts.timeToFirstQuizSeconds !== null ? formatDuration(facts.timeToFirstQuizSeconds)
            : quizReached ? "Not recorded" : "Quiz not started"}
        </Row>
      )}
      {facts.stage !== "not_started" && (
        <Row term="Quiz">
          <QuizResult facts={facts} />
        </Row>
      )}
      {facts.stage === "completed" && (
        <Row term="Completed">
          {facts.completedAt ? <LocalizedTimestamp value={facts.completedAt} /> : "Time not recorded"}
        </Row>
      )}
    </dl>
  );
}
