"use client";

import { useId, useState } from "react";
import type { QuizShellProps } from "./types";

const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-border bg-background px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function QuizShell({
  title,
  questions,
  passingThresholdPercent = 80,
  onComplete,
  onRetry,
}: QuizShellProps) {
  const groupId = useId();
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-card p-8 md:p-10">
        <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-base text-muted-foreground md:text-lg">
          No questions are available for this quiz yet.
        </p>
      </article>
    );
  }

  const current = questions[index];
  const total = questions.length;
  const percent = total === 0 ? 0 : Math.round((score / total) * 100);
  const passed = percent >= passingThresholdPercent;
  const isCorrect =
    selectedIndex !== null && selectedIndex === current.correctIndex;

  function resetQuiz() {
    onRetry?.();
    setIndex(0);
    setSelectedIndex(null);
    setSubmitted(false);
    setScore(0);
    setFinished(false);
  }

  function handleSubmit() {
    if (selectedIndex === null || submitted) return;

    const correct = selectedIndex === current.correctIndex;
    const nextScore = score + (correct ? 1 : 0);
    setScore(nextScore);
    setSubmitted(true);

    if (index === total - 1) {
      const finalPercent = Math.round((nextScore / total) * 100);
      onComplete?.({
        score: nextScore,
        total,
        percent: finalPercent,
        passed: finalPercent >= passingThresholdPercent,
      });
    }
  }

  function handleNext() {
    if (!submitted) return;

    if (index >= total - 1) {
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setSelectedIndex(null);
    setSubmitted(false);
  }

  if (finished) {
    return (
      <article className="rounded-2xl border border-border bg-card p-8 md:p-10">
        <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
          {title}
        </h2>
        <p className="mt-6 text-2xl font-medium text-foreground md:text-3xl">
          Section Quiz — Complete
        </p>
        <p className="mt-3 text-lg text-muted-foreground md:text-xl">
          Score: {score} / {total} ({percent}%)
        </p>
        <p
          className={`mt-3 text-lg font-semibold md:text-xl ${
            passed ? "text-accent" : "text-destructive"
          }`}
          role="status"
        >
          {passed
            ? `Passed — you needed ${passingThresholdPercent}% or higher.`
            : `Not passed — you need at least ${passingThresholdPercent}% to pass.`}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={resetQuiz}
            className={passed ? secondaryButtonClassName : primaryButtonClassName}
          >
            Try again
          </button>
          {passed && (
            <button type="button" className={primaryButtonClassName}>
              Continue to next section
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-8 md:p-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
          {title}
        </h2>
        <p className="text-base text-muted-foreground md:text-lg">
          Question {index + 1} of {total}
        </p>
      </div>

      <fieldset className="mt-8 border-0 p-0">
        <legend className="text-xl font-medium text-foreground md:text-2xl">
          {current.question}
        </legend>

        <div className="mt-6 flex flex-col gap-3" role="radiogroup">
          {current.options.map((option, optionIndex) => {
            const optionId = `${groupId}-option-${index}-${optionIndex}`;
            const selected = selectedIndex === optionIndex;
            const showResult = submitted && selected;
            const showCorrectAnswer =
              submitted && optionIndex === current.correctIndex;

            let optionStateClass =
              "border-border bg-background hover:border-ring/60";
            if (showCorrectAnswer) {
              optionStateClass =
                "border-accent bg-accent/10 text-foreground";
            } else if (showResult && !isCorrect) {
              optionStateClass =
                "border-destructive bg-destructive/10 text-foreground";
            } else if (selected && !submitted) {
              optionStateClass = "border-ring bg-muted";
            }

            return (
              <label
                key={optionId}
                htmlFor={optionId}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border px-4 py-4 text-base transition-colors md:text-lg ${optionStateClass} ${
                  submitted ? "cursor-default" : ""
                }`}
              >
                <input
                  id={optionId}
                  type="radio"
                  name={`${groupId}-q-${index}`}
                  value={optionIndex}
                  checked={selected}
                  disabled={submitted}
                  onChange={() => setSelectedIndex(optionIndex)}
                  className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {submitted && (
        <p
          className={`mt-6 text-base font-medium md:text-lg ${
            isCorrect ? "text-accent" : "text-destructive"
          }`}
          role="status"
        >
          {isCorrect
            ? "Correct!"
            : `Incorrect. The correct answer is: ${current.options[current.correctIndex]}`}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        {!submitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedIndex === null}
            className={primaryButtonClassName}
          >
            Submit
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className={primaryButtonClassName}
          >
            {index >= total - 1 ? "See results" : "Next question"}
          </button>
        )}
      </div>
    </article>
  );
}
