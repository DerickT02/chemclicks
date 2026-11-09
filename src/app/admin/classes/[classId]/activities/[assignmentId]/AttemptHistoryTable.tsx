import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import { LEWIS_QUIZZES } from "@/lib/assignments/lewis-quizzes";
import { BOHR_INTRO_QUIZ_KEY, BOHR_QUIZ_KEY, BOHR_STABILITY_QUIZ_KEY } from "@/lib/db/quiz-questions";
import { measurementAttemptLabel } from "@/lib/measurement/modes";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

// Names a teacher recognises; the stored key is an internal identifier.
const QUIZ_TITLES: Record<string, string> = {
  [BOHR_QUIZ_KEY]: "Bohr Models Quiz",
  [BOHR_INTRO_QUIZ_KEY]: "Bohr Model Introduction Quiz",
  [BOHR_STABILITY_QUIZ_KEY]: "Bohr Model Stability Quiz",
  [LEWIS_QUIZZES.covalent.quizKey]: LEWIS_QUIZZES.covalent.title,
  [LEWIS_QUIZZES.ionic.quizKey]: LEWIS_QUIZZES.ionic.title,
  [LEWIS_QUIZZES.diagram.quizKey]: LEWIS_QUIZZES.diagram.title,
};

type Props = {
  firstName: string;
  lastName: string;
  attempts: TeacherActivityAttemptSummary["students"][number]["attempts"];
};

export function AttemptHistoryTable({ firstName, lastName, attempts }: Props) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Attempt history for {firstName} {lastName}, newest first</caption>
        <thead><tr>{["Attempt", "Activity", "Status", "Started", "Completed"].map(title => <th key={title} scope="col" className="border-b border-border p-2">{title}</th>)}</tr></thead>
        <tbody>{attempts.map(attempt => (
          <tr key={attempt.id}>
            <th scope="row" className="p-2">{attempt.attemptNumber}</th>
            <td className="p-2">
              {attempt.instrument ? measurementAttemptLabel(attempt.instrument, attempt.precisionMode) : attempt.quizKey ? (Object.hasOwn(QUIZ_TITLES, attempt.quizKey) ? QUIZ_TITLES[attempt.quizKey] : "Quiz") : "Exploration"}
              {attempt.score != null && attempt.questionTotal != null && (
                <span className="block">{`${attempt.score}/${attempt.questionTotal} · ${attempt.passed ? "Passed" : "Not passed"}`}</span>
              )}
            </td>
            <td className="p-2">{attempt.status === "completed" ? "Completed" : "In progress"}</td>
            <td className="whitespace-nowrap p-2"><LocalizedTimestamp value={attempt.startedAt} /></td>
            <td className="whitespace-nowrap p-2">{attempt.completedAt ? <LocalizedTimestamp value={attempt.completedAt} /> : "Not completed"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
