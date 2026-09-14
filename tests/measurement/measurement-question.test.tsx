import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import GraduatedCylinder from "../../src/components/measurement/GraduatedCylinder";
import MeasurementQuiz, {
  AttemptResults,
  MeasurementQuestion,
} from "../../src/components/measurement/MeasurementQuiz";
import PrecisionRuler from "../../src/components/measurement/PrecisionRuler";
import { evaluateAnswer } from "../../src/lib/measurement/answer";
import { CYLINDER_SPEC, RULER_SPEC } from "../../src/lib/measurement/instruments";
import type { QuestionState, ResultsState } from "../../src/lib/measurement/quiz";

function rulerQuestion(overrides: Partial<QuestionState> = {}): QuestionState {
  return {
    phase: "question",
    instrument: "ruler",
    readings: [4.37, 11.62, 2.85, 7.18, 9.21],
    questionIndex: 0,
    answer: "",
    result: null,
    attempt: 0,
    firstTryCorrect: null,
    score: 0,
    ...overrides,
  };
}

function cylinderQuestion(overrides: Partial<QuestionState> = {}): QuestionState {
  return rulerQuestion({
    instrument: "cylinder",
    readings: [23.4, 41.7, 8.6, 31.1, 17.2],
    ...overrides,
  });
}

function render(question: QuestionState): string {
  return renderToStaticMarkup(<MeasurementQuestion question={question} dispatch={() => {}} />);
}

function renderResults(results: ResultsState): string {
  return renderToStaticMarkup(
    <AttemptResults results={results} onTryAgain={() => {}} onChooseInstrument={() => {}} />,
  );
}

function attribute(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  if (!match) throw new Error(`No match for ${pattern}`);
  return match[1];
}

/** The SVG path data in some markup: where the cursor, water, and meniscus are drawn. */
function drawnPaths(html: string): string[] {
  return [...html.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
}

describe("MeasurementQuiz", () => {
  it("starts on an accessible instrument chooser that explains the attempt", () => {
    const html = renderToStaticMarkup(<MeasurementQuiz />);

    expect(html).toContain("Choose an instrument");
    expect(html).toContain("5 random questions");
    expect(html).toContain("at least 4 correctly on your first try to pass");
    expect(html).toContain("Start ruler questions");
    expect(html).toContain("Start graduated cylinder questions");
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
  });
});

describe("MeasurementQuestion", () => {
  it("shows the ruler with its scale, units, and required precision", () => {
    const html = render(rulerQuestion());

    expect(html).toContain("Ruler question 1 of 5");
    expect(html).toContain("0–15 cm, marked every 0.1 cm");
    expect(html).toContain("centimeters (cm)");
    expect(html).toContain("the nearest 0.01 cm (2 decimal places)");
    expect(html).toContain("±0.02 cm");
    expect(html).toContain("<title>Ruler with measurement cursor</title>");
  });

  it("shows the graduated cylinder with its scale, units, and required precision", () => {
    const html = render(cylinderQuestion());

    expect(html).toContain("Graduated cylinder question 1 of 5");
    expect(html).toContain("0–50 mL, marked every 1 mL");
    expect(html).toContain("milliliters (mL)");
    expect(html).toContain("the nearest 0.1 mL (1 decimal place)");
    expect(html).toContain("bottom of the meniscus");
    expect(html).toContain("<title>Graduated cylinder holding water</title>");
  });

  it("explains the scoring rule and the pass mark", () => {
    const html = render(rulerQuestion());

    expect(html).toContain("Only your first answer to each question is scored.");
    expect(html).toContain("Get 4 of 5 right to pass.");
  });

  it("draws each instrument locked at the current question's reading", () => {
    expect(drawnPaths(render(rulerQuestion({ questionIndex: 1 })))).toEqual(
      drawnPaths(renderToStaticMarkup(<PrecisionRuler lockedValue={11.62} />)),
    );
    expect(drawnPaths(render(cylinderQuestion({ questionIndex: 1 })))).toEqual(
      drawnPaths(renderToStaticMarkup(<GraduatedCylinder lockedValue={41.7} />)),
    );
  });

  it("reveals the reading neither on screen nor to assistive tech", () => {
    for (const [html, reading] of [
      [render(rulerQuestion()), "4.37"],
      [render(cylinderQuestion()), "23.4"],
    ]) {
      expect(html).not.toContain(reading);
      expect(html).not.toContain('role="slider"');
      expect(html).not.toContain("aria-value");
      expect(html).toContain('role="img"');
    }
  });

  it("labels the answer input and points it at the hint and feedback", () => {
    const html = render(rulerQuestion());
    const inputId = attribute(html, /<label for="([^"]+)"/);
    const describedBy = attribute(html, /aria-describedby="([^"]+)"/).split(" ");

    expect(html).toContain(`id="${inputId}"`);
    expect(html).toContain("Your reading, in centimeters");
    expect(html).toContain('inputMode="decimal"');
    expect(describedBy).toHaveLength(2);
    for (const id of describedBy) expect(html).toContain(`id="${id}"`);
    expect(html).toMatch(/role="status" aria-live="polite"/);
    expect(html).toContain('<button type="submit"');
    expect(html).toContain("Check answer");
  });

  it("flags an invalid answer and offers no way to advance", () => {
    const result = evaluateAnswer("abc", 4.37, RULER_SPEC);
    const html = render(rulerQuestion({ answer: "abc", result, attempt: 1 }));

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(result.message);
    expect(html).toContain("Check answer");
    expect(html).not.toContain("Next question");
    expect(html).not.toContain("Correct");
  });

  it("shows correct feedback and a way to continue", () => {
    const result = evaluateAnswer("4.37", 4.37, RULER_SPEC);
    const html = render(
      rulerQuestion({ answer: "4.37", result, attempt: 1, firstTryCorrect: true, score: 1 }),
    );

    expect(html).toContain("Correct");
    expect(html).not.toContain("Incorrect");
    expect(html).toContain("The reading is 4.37 cm.");
    expect(html).toContain("Next question");
    expect(html).toContain("readOnly");
    expect(html).not.toContain("Check answer");
    expect(html).not.toContain("change your score");
  });

  it("tells the student a correct retry doesn't change their score", () => {
    const result = evaluateAnswer("4.37", 4.37, RULER_SPEC);
    const html = render(rulerQuestion({ answer: "4.37", result, attempt: 2, firstTryCorrect: false }));

    expect(html).toContain("Correct");
    expect(html).toContain("Only your first answer is scored, so this one doesn&#x27;t change your score.");
  });

  it("offers See results on the last question", () => {
    const result = evaluateAnswer("17.2", 17.2, CYLINDER_SPEC);
    const html = render(
      cylinderQuestion({ questionIndex: 4, answer: "17.2", result, firstTryCorrect: true }),
    );

    expect(html).toContain("Graduated cylinder question 5 of 5");
    expect(html).toContain("See results");
  });

  it("shows incorrect feedback with options to retry or skip", () => {
    const result = evaluateAnswer("30.0", 23.4, CYLINDER_SPEC);
    const html = render(
      cylinderQuestion({ answer: "30.0", result, attempt: 1, firstTryCorrect: false }),
    );

    expect(html).toContain("Incorrect");
    expect(html).not.toContain(">Correct<");
    expect(html).toContain("Check answer");
    expect(html).toContain("Skip to next question");
    expect(html).not.toContain("23.4 mL");
  });
});

describe("AttemptResults", () => {
  it("shows a pass at 4 of 5", () => {
    const html = renderResults({ phase: "results", instrument: "ruler", score: 4, total: 5 });

    expect(html).toContain("Ruler results: 4 of 5 correct");
    expect(html).toContain("Passed");
    expect(html).toContain("(80%)");
    expect(html).toContain("Try again with new questions");
    expect(html).toContain("Choose a different instrument");
  });

  it("shows a fail at 3 of 5 with the score needed", () => {
    const html = renderResults({ phase: "results", instrument: "cylinder", score: 3, total: 5 });

    expect(html).toContain("Graduated cylinder results: 3 of 5 correct");
    expect(html).toContain("Not passed yet");
    expect(html).toContain("(60%)");
    expect(html).toContain("Passing takes 4 of 5 (80%).");
    expect(html).not.toContain(">Passed<");
  });
});
