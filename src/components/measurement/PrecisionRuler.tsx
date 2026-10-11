"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  RULER_SPEC,
  formatReading,
  quantizeReading,
} from "@/lib/measurement/instruments";

export const RULER_MIN_CM = RULER_SPEC.min;
export const RULER_MAX_CM = RULER_SPEC.max;
export const STEP_CM = RULER_SPEC.step;
export const DEFAULT_CM = RULER_SPEC.defaultReading;

const SPAN_CM = RULER_MAX_CM - RULER_MIN_CM;
const SCALE_LEFT_X = 24;
const SCALE_RIGHT_X = 336;
const SCALE_WIDTH = SCALE_RIGHT_X - SCALE_LEFT_X;
const BASELINE_Y = 60;
const BAR_HEIGHT = 34;
const BAR_BOTTOM_Y = BASELINE_Y + BAR_HEIGHT;
const LABEL_WIDTH = 84;
const SCALE_CM = Array.from({ length: SPAN_CM + 1 }, (_, index) => RULER_MIN_CM + index);

export type RulerPrecision = "tenths" | "hundredths";

const RULER_SPECS = {
  tenths: { ...RULER_SPEC, graduation: 1, step: 0.1, decimals: 1 },
  hundredths: RULER_SPEC,
};

export function quantizeCm(cm: number, precision: RulerPrecision = "hundredths"): number {
  return quantizeReading(cm, RULER_SPECS[precision]);
}

export function formatCm(cm: number, precision: RulerPrecision = "hundredths"): string {
  return formatReading(cm, RULER_SPECS[precision]);
}

function cmToX(cm: number): number {
  return SCALE_LEFT_X + ((cm - RULER_MIN_CM) / SPAN_CM) * SCALE_WIDTH;
}

type Props = {
  precision?: RulerPrecision;
  /** Shared physical position; display rounding must not move the cursor. */
  value?: number;
  onValueChange?: (value: number) => void;
  sliderLabel?: string;
  /**
   * Pin the cursor at this reading, in centimeters, for a question. The student
   * can't move it, and neither the readout nor assistive tech reveals the value.
   */
  lockedValue?: number;
};

export default function PrecisionRuler({
  lockedValue, precision = "hundredths", value, onValueChange, sliderLabel = "Measured length",
}: Props) {
  const [movableCm, setValueCm] = useState(DEFAULT_CM);
  const isLocked = lockedValue !== undefined;
  const motionPrecision = value !== undefined ? "hundredths" : precision;
  const valueCm = quantizeCm(lockedValue ?? value ?? movableCm, motionPrecision);
  const spec = RULER_SPECS[precision];
  const step = spec.step;
  const graduations = Array.from({ length: SPAN_CM / spec.graduation + 1 }, (_, index) =>
    Number((RULER_MIN_CM + index * spec.graduation).toFixed(1)),
  );

  function updateValue(cm: number) {
    const next = quantizeCm(cm, motionPrecision);
    setValueCm(next);
    onValueChange?.(next);
  }

  function setFromPointer(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;

    const position = (event.clientX - rect.left) / rect.width;
    updateValue(RULER_MIN_CM + position * SPAN_CM);
  }

  function handlePointerDown(event: PointerEvent<SVGRectElement>) {
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      setFromPointer(event);
    }
  }

  function stopDragging(event: PointerEvent<SVGRectElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      if (event.type === "pointerup") setFromPointer(event);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<SVGRectElement>) {
    // Home and End overshoot so quantization clamps to the exact endpoints.
    const deltas: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      Home: -SPAN_CM,
      End: SPAN_CM,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    updateValue(valueCm + delta);
  }

  const cursorX = cmToX(valueCm);
  const formattedValue = formatCm(valueCm, precision);

  return (
    <div className="flex justify-center py-2">
      {/* Leave room for a centered badge at either endpoint. */}
      <svg
        viewBox="-24 0 408 150"
        className="h-auto w-full max-w-3xl overflow-visible select-none"
        role={isLocked ? "img" : undefined}
      >
        <title>
          {isLocked ? "Ruler with measurement cursor" : "Ruler with adjustable measurement cursor"}
        </title>

        <rect
          x={SCALE_LEFT_X}
          y={BASELINE_Y}
          width={SCALE_WIDTH}
          height={BAR_HEIGHT}
          fill="var(--card)"
          stroke="var(--muted-foreground)"
          strokeOpacity="0.7"
          strokeWidth="2"
        />

        <g aria-hidden="true">
          {graduations.map((cm) => {
            const isMajor = Number.isInteger(cm);
            const isHalf = Math.round(cm * 10) % 5 === 0;
            const x = cmToX(cm);

            return (
              <line
                key={cm}
                x1={x}
                x2={x}
                y1={BASELINE_Y}
                y2={BASELINE_Y + (isMajor ? 30 : isHalf ? 20 : 12)}
                stroke="var(--foreground)"
                strokeOpacity={isMajor ? 0.68 : isHalf ? 0.48 : 0.3}
                strokeWidth={isMajor ? 1.6 : 1}
              />
            );
          })}

          {SCALE_CM.map((cm) => (
            <text
              key={cm}
              x={cmToX(cm)}
              y={BAR_BOTTOM_Y + 18}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              className="font-mono text-[16px]"
            >
              {cm}
            </text>
          ))}

          <text
            x={SCALE_RIGHT_X}
            y={BAR_BOTTOM_Y + 40}
            textAnchor="end"
            fill="var(--muted-foreground)"
            className="font-mono text-[16px]"
          >
            cm
          </text>
        </g>

        <g aria-hidden="true">
          <line
            x1={cursorX}
            x2={cursorX}
            y1={BASELINE_Y - 14}
            y2={BAR_BOTTOM_Y}
            stroke="var(--accent)"
            strokeWidth="2"
          />
          <path
            d={`M ${cursorX - 7} ${BASELINE_Y - 14} L ${cursorX + 7} ${BASELINE_Y - 14} L ${cursorX} ${BASELINE_Y - 2} Z`}
            fill="var(--accent)"
          />

          {!isLocked && (
            <g transform={`translate(${cursorX - LABEL_WIDTH / 2} ${BASELINE_Y - 46})`}>
              <rect
                width={LABEL_WIDTH}
                height="28"
                rx="14"
                fill="var(--card)"
                stroke="var(--accent)"
                strokeOpacity="0.55"
              />
              <text
                x={LABEL_WIDTH / 2}
                y="18.5"
                textAnchor="middle"
                fill="var(--accent)"
                className="font-mono text-[16px] font-semibold"
              >
                {formattedValue} cm
              </text>
            </g>
          )}
        </g>

        {/* A locked ruler is a question, so it has no slider to announce the reading. */}
        {!isLocked && (
          <rect
            x={SCALE_LEFT_X}
            y={BASELINE_Y - 20}
            width={SCALE_WIDTH}
            height={BAR_HEIGHT + 20}
            rx="8"
            fill="transparent"
            stroke="transparent"
            strokeWidth="3"
            className="cursor-ew-resize touch-none outline-none focus:stroke-[var(--ring)]"
            role="slider"
            tabIndex={0}
            aria-label={sliderLabel}
            aria-valuemin={RULER_MIN_CM}
            aria-valuemax={RULER_MAX_CM}
            aria-valuenow={valueCm}
            aria-valuetext={`${formattedValue} centimeters`}
            aria-orientation="horizontal"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onKeyDown={handleKeyDown}
          />
        )}
      </svg>
    </div>
  );
}
