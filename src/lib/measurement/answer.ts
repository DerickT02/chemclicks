import {
  describeDecimalPlaces,
  exampleAnswer,
  formatReading,
  formatTolerance,
  type InstrumentSpec,
} from "@/lib/measurement/instruments";

export type AnswerErrorCode = "empty" | "not-a-number" | "malformed" | "out-of-range";

export type AnswerResult =
  | { status: "invalid"; code: AnswerErrorCode; message: string }
  | { status: "incorrect"; reason: "precision" | "value"; message: string }
  | { status: "correct"; message: string };

// Digits with at most one decimal point and an optional sign. Units, commas,
// exponents, and a trailing decimal point are rejected so that what the student
// typed is exactly the value that gets graded.
const PLAIN_DECIMAL = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

function invalid(code: AnswerErrorCode, message: string): AnswerResult {
  return { status: "invalid", code, message };
}

/**
 * Grades a typed answer against the instrument's current reading. The tolerance
 * and required precision come from the instrument spec; see instruments.ts.
 */
export function evaluateAnswer(
  input: string,
  reading: number,
  spec: InstrumentSpec,
): AnswerResult {
  const answer = input.trim();
  const example = exampleAnswer(spec);

  if (answer === "") {
    return invalid("empty", "Enter your reading before checking your answer.");
  }

  if (!/\d/.test(answer)) {
    return invalid("not-a-number", `Your answer must be a number, like ${example}.`);
  }

  if (!PLAIN_DECIMAL.test(answer)) {
    return invalid(
      "malformed",
      `Enter just the number, like ${example}, with no units, commas, spaces, or extra decimal points.`,
    );
  }

  const value = Number(answer);
  if (value < spec.min || value > spec.max) {
    return invalid(
      "out-of-range",
      `This ${spec.name.toLowerCase()} reads from ${spec.min} to ${spec.max} ${spec.unit}. Enter a reading in that range.`,
    );
  }

  const answerDecimals = answer.split(".")[1]?.length ?? 0;
  if (answerDecimals !== spec.decimals) {
    return {
      status: "incorrect",
      reason: "precision",
      message: `Report the reading to ${describeDecimalPlaces(spec.decimals)} (the nearest ${spec.step} ${spec.unit}), like ${example}.`,
    };
  }

  // Compare in whole units of the last reported digit so floating-point noise
  // cannot push an answer across the tolerance boundary.
  const scale = 10 ** spec.decimals;
  const difference = Math.abs(Math.round(value * scale) - Math.round(reading * scale));
  const allowed = Math.round(spec.tolerance * scale);
  const given = `${value.toFixed(spec.decimals)} ${spec.unit}`;
  const expected = `${formatReading(reading, spec)} ${spec.unit}`;

  if (difference > allowed) {
    return {
      status: "incorrect",
      reason: "value",
      message: `${given} is more than ${formatTolerance(spec)} from the reading. Look at the scale again and try another answer.`,
    };
  }

  return {
    status: "correct",
    message:
      difference === 0
        ? `The reading is ${expected}.`
        : `The reading is ${expected}, and ${given} is within the accepted ${formatTolerance(spec)}.`,
  };
}
