export type InstrumentId = "ruler" | "cylinder";

export type InstrumentSpec = {
  name: string;
  unit: string;
  unitName: string;
  min: number;
  max: number;
  /** Spacing of the smallest printed marks on the scale. */
  graduation: number;
  /**
   * Resolution of the simulated reading. A scale is read by estimating one
   * digit past its smallest graduation, so this is a tenth of `graduation`.
   */
  step: number;
  /** Decimal places a reading is reported to; matches `step`. */
  decimals: number;
  /** Accepted distance between an answer and the simulated reading. */
  tolerance: number;
  defaultReading: number;
};

/*
 * Answer tolerance
 *
 * The estimated digit (one past the smallest graduation) is the uncertain one
 * in any scale reading. An answer is marked correct when it is within ±2 in
 * that estimated digit, i.e. one fifth of a graduation, of the reading:
 *
 *   ruler               marks every 0.1 cm, report to 0.01 cm, accept ±0.02 cm
 *   graduated cylinder  marks every 1 mL,   report to 0.1 mL,  accept ±0.2 mL
 *
 * Answers must also be written to exactly `decimals` places, because the number
 * of digits reported is what communicates the precision of a measurement.
 */

export const RULER_SPEC: InstrumentSpec = {
  name: "Ruler",
  unit: "cm",
  unitName: "centimeters",
  min: 0,
  max: 15,
  graduation: 0.1,
  step: 0.01,
  decimals: 2,
  tolerance: 0.02,
  defaultReading: 7.5,
};

export const CYLINDER_SPEC: InstrumentSpec = {
  name: "Graduated cylinder",
  unit: "mL",
  unitName: "milliliters",
  min: 0,
  max: 50,
  graduation: 1,
  step: 0.1,
  decimals: 1,
  tolerance: 0.2,
  defaultReading: 32,
};

export const INSTRUMENT_IDS: readonly InstrumentId[] = ["ruler", "cylinder"];

export const INSTRUMENTS: Record<InstrumentId, InstrumentSpec> = {
  ruler: RULER_SPEC,
  cylinder: CYLINDER_SPEC,
};

export function quantizeReading(value: number, spec: InstrumentSpec): number {
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  return Number((Math.round(clamped / spec.step) * spec.step).toFixed(spec.decimals));
}

export function formatReading(value: number, spec: InstrumentSpec): string {
  return quantizeReading(value, spec).toFixed(spec.decimals);
}

export function formatTolerance(spec: InstrumentSpec): string {
  return `±${spec.tolerance.toFixed(spec.decimals)} ${spec.unit}`;
}

export function describeDecimalPlaces(decimals: number): string {
  return `${decimals} decimal ${decimals === 1 ? "place" : "places"}`;
}

/** A sample answer with the right number of decimal places for this instrument. */
export function exampleAnswer(spec: InstrumentSpec): string {
  return (12.3456).toFixed(spec.decimals);
}
