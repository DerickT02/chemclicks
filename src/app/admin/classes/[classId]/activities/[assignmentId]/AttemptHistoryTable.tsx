import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
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
    <Table containerClassName="mt-3">
      <TableCaption className="sr-only">Attempt history for {firstName} {lastName}, newest first</TableCaption>
      <TableHeader>
        <TableRow>
          {["Attempt", "Activity", "Status", "Started", "Completed"].map(title => <TableHead key={title}>{title}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {attempts.map(attempt => (
          <TableRow key={attempt.id}>
            <TableHead scope="row">{attempt.attemptNumber}</TableHead>
            <TableCell>
              {attempt.instrument ? measurementAttemptLabel(attempt.instrument, attempt.precisionMode) : attempt.quizKey ? (Object.hasOwn(QUIZ_TITLES, attempt.quizKey) ? QUIZ_TITLES[attempt.quizKey] : "Quiz") : "Exploration"}
              {attempt.score != null && attempt.questionTotal != null && (
                <span className="block">{`${attempt.score}/${attempt.questionTotal} · ${attempt.passed ? "Passed" : "Not passed"}`}</span>
              )}
            </TableCell>
            <TableCell>{attempt.status === "completed" ? "Completed" : "In progress"}</TableCell>
            <TableCell className="whitespace-nowrap"><LocalizedTimestamp value={attempt.startedAt} /></TableCell>
            <TableCell className="whitespace-nowrap">{attempt.completedAt ? <LocalizedTimestamp value={attempt.completedAt} /> : "Not completed"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
