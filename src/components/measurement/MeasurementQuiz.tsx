"use client";

import {
  useEffect,
  useId,
  useReducer,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import GraduatedCylinder from "@/components/measurement/GraduatedCylinder";
import PrecisionRuler from "@/components/measurement/PrecisionRuler";
import type { AnswerResult } from "@/lib/measurement/answer";
import {
  INSTRUMENT_IDS,
  INSTRUMENTS,
  describeDecimalPlaces,
  exampleAnswer,
  formatTolerance,
  type InstrumentId,
} from "@/lib/measurement/instruments";
import {
  INITIAL_QUIZ_STATE,
  PASS_PERCENT,
  QUESTIONS_PER_ATTEMPT,
  currentReading,
  hasPassed,
  passingScore,
  pickReadings,
  quizReducer,
  type QuestionState,
  type QuizAction,
  type ResultsState,
} from "@/lib/measurement/quiz";

const PROMPTS: Record<InstrumentId, string> = {
  ruler: "What length does the cursor point to on the ruler?",
  cylinder:
    "What volume of water is in the graduated cylinder? Read at the bottom of the meniscus.",
};

const PRIMARY_BUTTON_CLASS =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring";

type PanelProps = {
  heading: string;
  /**
   * Focus the heading on mount. Set this when the control that had focus has
   * just unmounted, so keyboard and screen reader users start at the top.
   */
  focusHeading: boolean;
  action?: ReactNode;
  children: ReactNode;
};

function Panel({ heading, focusHeading, action, children }: PanelProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="font-semibold text-foreground outline-none"
        >
          {heading}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type VerdictProps = {
  success: boolean;
  title: string;
  message: string;
  children?: ReactNode;
};

function Verdict({ success, title, message, children }: VerdictProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        success ? "border-accent bg-accent/10" : "border-destructive bg-destructive/10"
      }`}
    >
      <p className="font-semibold text-foreground">
        <span aria-hidden="true">{success ? "✓ " : "✗ "}</span>
        {title}
      </p>
      <p className="mt-1 text-sm text-foreground">{message}</p>
      {children}
    </div>
  );
}

type ChooserProps = {
  returned: boolean;
  onStart: (instrument: InstrumentId) => void;
};

function InstrumentChooser({ returned, onStart }: ChooserProps) {
  // On first load, leave focus where the browser put it.
  return (
    <Panel heading="Choose an instrument" focusHeading={returned}>
      <p className="mt-2 text-sm text-muted-foreground">
        {`Each attempt asks ${QUESTIONS_PER_ATTEMPT} random questions about one instrument, shown without its readout. Answer at least ${passingScore(QUESTIONS_PER_ATTEMPT)} correctly on your first try to pass.`}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {INSTRUMENT_IDS.map((id) => {
          const spec = INSTRUMENTS[id];

          return (
            <button
              key={id}
              type="button"
              onClick={() => onStart(id)}
              className="rounded-lg border border-border bg-muted p-4 text-left outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block font-semibold text-foreground">
                {`Start ${spec.name.toLowerCase()} questions`}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {`${spec.min}–${spec.max} ${spec.unit}, read to the nearest ${spec.step} ${spec.unit}`}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

type FeedbackProps = {
  result: AnswerResult;
  countedInScore: boolean;
};

function Feedback({ result, countedInScore }: FeedbackProps) {
  if (result.status === "invalid") {
    return <p className="text-sm font-medium text-destructive">{result.message}</p>;
  }

  const isCorrect = result.status === "correct";

  return (
    <Verdict
      success={isCorrect}
      title={isCorrect ? "Correct" : "Incorrect"}
      message={result.message}
    >
      {isCorrect && !countedInScore && (
        <p className="mt-1 text-sm text-muted-foreground">
          Only your first answer is scored, so this one doesn&apos;t change your score.
        </p>
      )}
    </Verdict>
  );
}

type QuestionProps = {
  question: QuestionState;
  dispatch: (action: QuizAction) => void;
};

export function MeasurementQuestion({ question, dispatch }: QuestionProps) {
  const spec = INSTRUMENTS[question.instrument];
  const reading = currentReading(question);
  const questionCount = question.readings.length;
  const isLastQuestion = question.questionIndex === questionCount - 1;
  const { result } = question;
  const isCorrect = result?.status === "correct";

  const idPrefix = useId();
  const inputId = `${idPrefix}-answer`;
  const hintId = `${idPrefix}-hint`;
  const feedbackId = `${idPrefix}-feedback`;
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Invalid and incorrect answers keep the student on the input to retry. A
    // correct answer mounts the Next button, which takes focus with autoFocus.
    inputRef.current?.focus();
    dispatch({ type: "submit" });
  }

  const continueLabel = isLastQuestion ? "See results" : "Next question";

  // Questions are keyed, so the heading takes focus once per question.
  return (
    <Panel
      heading={`${spec.name} question ${question.questionIndex + 1} of ${questionCount}`}
      focusHeading
      action={
        <button
          type="button"
          onClick={() => dispatch({ type: "choose-instrument" })}
          className="rounded-md text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Choose a different instrument
        </button>
      }
    >
      <p className="mt-2 text-foreground">{PROMPTS[question.instrument]}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {`Only your first answer to each question is scored. Get ${passingScore(questionCount)} of ${questionCount} right to pass.`}
      </p>

      <dl className="mt-4 grid gap-4 rounded-lg border border-border bg-muted p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Scale</dt>
          <dd className="mt-1 text-foreground">
            {`${spec.min}–${spec.max} ${spec.unit}, marked every ${spec.graduation} ${spec.unit}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Units</dt>
          <dd className="mt-1 text-foreground">{`${spec.unitName} (${spec.unit})`}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Report to</dt>
          <dd className="mt-1 text-foreground">
            {`the nearest ${spec.step} ${spec.unit} (${describeDecimalPlaces(spec.decimals)})`}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        {question.instrument === "ruler" ? (
          <PrecisionRuler lockedValue={reading} />
        ) : (
          <GraduatedCylinder lockedValue={reading} />
        )}
      </div>

      <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {`Your reading, in ${spec.unitName}`}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={question.answer}
              onChange={(event) =>
                dispatch({ type: "edit-answer", answer: event.target.value })
              }
              readOnly={isCorrect}
              aria-invalid={result?.status === "invalid"}
              aria-describedby={`${hintId} ${feedbackId}`}
              className="w-32 rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground outline-none read-only:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
            />
            <span aria-hidden="true" className="font-mono text-sm text-muted-foreground">
              {spec.unit}
            </span>
          </div>
          {!isCorrect && (
            <button type="submit" className={PRIMARY_BUTTON_CLASS}>
              Check answer
            </button>
          )}
        </div>
        <p id={hintId} className="text-xs text-muted-foreground">
          {`Enter a number with ${describeDecimalPlaces(spec.decimals)}, like ${exampleAnswer(spec)}. Answers within ${formatTolerance(spec)} of the reading are marked correct.`}
        </p>
      </form>

      <div id={feedbackId} role="status" aria-live="polite" className="mt-4">
        {result && (
          <Feedback
            key={question.attempt}
            result={result}
            countedInScore={question.firstTryCorrect === true}
          />
        )}
      </div>

      {result && result.status !== "invalid" && (
        <div className="mt-4 flex flex-wrap gap-3">
          {/* Distinct keys so a correct retry mounts a new button and autoFocus fires. */}
          {isCorrect ? (
            <button
              key="next"
              type="button"
              autoFocus
              onClick={() => dispatch({ type: "next" })}
              className={PRIMARY_BUTTON_CLASS}
            >
              {continueLabel}
            </button>
          ) : (
            <button
              key="skip"
              type="button"
              onClick={() => dispatch({ type: "next" })}
              className={SECONDARY_BUTTON_CLASS}
            >
              {isLastQuestion ? "Skip and see results" : "Skip to next question"}
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}

type ResultsProps = {
  results: ResultsState;
  onTryAgain: () => void;
  onChooseInstrument: () => void;
};

export function AttemptResults({ results, onTryAgain, onChooseInstrument }: ResultsProps) {
  const spec = INSTRUMENTS[results.instrument];
  const passed = hasPassed(results.score, results.total);
  const percent = Math.round((results.score / results.total) * 100);

  // The button that finished the attempt is gone, so focus starts on the score.
  return (
    <Panel
      heading={`${spec.name} results: ${results.score} of ${results.total} correct`}
      focusHeading
    >
      <div className="mt-4">
        <Verdict
          success={passed}
          title={passed ? "Passed" : "Not passed yet"}
          message={`You answered ${results.score} of ${results.total} correctly on the first try (${percent}%). Passing takes ${passingScore(results.total)} of ${results.total} (${PASS_PERCENT}%).`}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onTryAgain} className={PRIMARY_BUTTON_CLASS}>
          Try again with new questions
        </button>
        <button type="button" onClick={onChooseInstrument} className={SECONDARY_BUTTON_CLASS}>
          Choose a different instrument
        </button>
      </div>
    </Panel>
  );
}

export default function MeasurementQuiz() {
  const [state, dispatch] = useReducer(quizReducer, INITIAL_QUIZ_STATE);

  // The random draw happens here, in an event handler, rather than in the
  // reducer: React can call a reducer twice and needs the same result both times.
  function startAttempt(instrument: InstrumentId) {
    dispatch({ type: "start", instrument, readings: pickReadings(instrument) });
  }

  if (state.phase === "choosing") {
    return <InstrumentChooser returned={state.returned} onStart={startAttempt} />;
  }

  if (state.phase === "results") {
    return (
      <AttemptResults
        results={state}
        onTryAgain={() => startAttempt(state.instrument)}
        onChooseInstrument={() => dispatch({ type: "choose-instrument" })}
      />
    );
  }

  return (
    <MeasurementQuestion
      key={`${state.instrument}-${state.questionIndex}`}
      question={state}
      dispatch={dispatch}
    />
  );
}
