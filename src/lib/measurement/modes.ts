import {
  CYLINDER_SPEC,
  RULER_SPEC,
  type InstrumentSpec,
} from "@/lib/measurement/instruments";
import type { ActivityType } from "@/lib/db/activities";

export type MeasurementQuizModeKey =
  | "ruler_tenths"
  | "ruler_hundredths"
  | "cylinder_tenths";

export type MeasurementQuizMode = {
  key: MeasurementQuizModeKey;
  instrument: "ruler" | "cylinder";
  precision: "tenths" | "hundredths";
  spec: InstrumentSpec;
};

const RULER_TENTHS_SPEC: InstrumentSpec = {
  ...RULER_SPEC,
  step: 0.1,
  decimals: 1,
  tolerance: 0.02,
};

const MODES: Record<MeasurementQuizModeKey, MeasurementQuizMode> = {
  ruler_tenths: {
    key: "ruler_tenths",
    instrument: "ruler",
    precision: "tenths",
    spec: RULER_TENTHS_SPEC,
  },
  ruler_hundredths: {
    key: "ruler_hundredths",
    instrument: "ruler",
    precision: "hundredths",
    spec: RULER_SPEC,
  },
  cylinder_tenths: {
    key: "cylinder_tenths",
    instrument: "cylinder",
    precision: "tenths",
    spec: CYLINDER_SPEC,
  },
};

export function getMeasurementQuizMode(
  key: MeasurementQuizModeKey,
): MeasurementQuizMode {
  return MODES[key];
}

export function measurementQuizModeForActivity(
  type: ActivityType,
): MeasurementQuizMode | null {
  switch (type) {
    case "measurement_ruler_tenths":
      return MODES.ruler_tenths;
    case "measurement_ruler_hundredths":
      return MODES.ruler_hundredths;
    case "measurement_graduated_cylinder":
      return MODES.cylinder_tenths;
    default:
      return null;
  }
}
