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

// Exploration time is the saved first-exploration-start to first-quiz-start
// interval; quiz-taking time is never added to it. Missing history reads as
// "not recorded" rather than a guessed value. Rows that would only repeat the
// stage ("Not started", "Quiz not started") are left out.
export function AssignmentProgressDetails({ facts, className }: Props) {
  if (facts.stage === "not_started") return null;
  const quizReached = hasReachedQuiz(facts.stage) || facts.firstQuizStartedAt !== null
    || facts.passingQuizAttemptNumber !== null || facts.failedQuizAttemptCount > 0;

  return (
    <dl className={className ?? "space-y-1 text-sm text-muted-foreground"}>
      <Row term="Exploration started">
        {facts.explorationStartedAt ? <LocalizedTimestamp value={facts.explorationStartedAt} /> : "Start time not recorded"}
      </Row>
      {(facts.timeToFirstQuizSeconds !== null || quizReached) && (
        <Row term="Exploration to first quiz">
          {facts.timeToFirstQuizSeconds !== null ? formatDuration(facts.timeToFirstQuizSeconds) : "Not recorded"}
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
