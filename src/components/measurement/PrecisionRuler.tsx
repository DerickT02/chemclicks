"use client";

import {
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

export const RULER_MIN_CM = 0;
export const RULER_MAX_CM = 15;
export const STEP_CM = 0.01;
export const DEFAULT_CM = 7.5;

const SCALE_LEFT_X = 40;
const SCALE_RIGHT_X = 560;
const SCALE_WIDTH = SCALE_RIGHT_X - SCALE_LEFT_X;
const BASELINE_Y = 60;
const BAR_HEIGHT = 34;
const BAR_BOTTOM_Y = BASELINE_Y + BAR_HEIGHT;
const MAJOR_TICKS_CM = Array.from(
  { length: RULER_MAX_CM - RULER_MIN_CM + 1 },
  (_, index) => RULER_MIN_CM + index,
);
const MINOR_TICKS_CM = Array.from(
  { length: Math.round((RULER_MAX_CM - RULER_MIN_CM) / 0.1) + 1 },
  (_, index) => Number((RULER_MIN_CM + index * 0.1).toFixed(1)),
);

export function clampCm(cm: number): number {
  return Math.min(RULER_MAX_CM, Math.max(RULER_MIN_CM, cm));
}

export function quantizeCm(cm: number): number {
  const clamped = clampCm(cm);
  return Number((Math.round(clamped / STEP_CM) * STEP_CM).toFixed(2));
}

export function formatCm(cm: number): string {
  return quantizeCm(cm).toFixed(2);
}

function cmToX(cm: number): number {
  return SCALE_LEFT_X + ((cm - RULER_MIN_CM) / (RULER_MAX_CM - RULER_MIN_CM)) * SCALE_WIDTH;
}

export default function PrecisionRuler() {
  const [valueCm, setValueCm] = useState(DEFAULT_CM);

  function setFromPointer(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;

    const fraction = (event.clientX - rect.left) / rect.width;
    setValueCm(quantizeCm(RULER_MIN_CM + fraction * (RULER_MAX_CM - RULER_MIN_CM)));
  }

  function handlePointerDown(event: PointerEvent<SVGRectElement>) {
    event.preventDefault();
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
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<SVGRectElement>) {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        setValueCm((current) => quantizeCm(current - STEP_CM));
        break;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        setValueCm((current) => quantizeCm(current + STEP_CM));
        break;
      case "Home":
        event.preventDefault();
        setValueCm(RULER_MIN_CM);
        break;
      case "End":
        event.preventDefault();
        setValueCm(RULER_MAX_CM);
        break;
      default:
        break;
    }
  }

  const cursorX = cmToX(valueCm);
  const formattedValue = formatCm(valueCm);
  const labelWidth = 84;
  const labelX = Math.min(
    SCALE_RIGHT_X - labelWidth / 2,
    Math.max(SCALE_LEFT_X + labelWidth / 2, cursorX),
  );

  return (
    <div className="flex justify-center py-2">
      <svg
        viewBox="0 0 600 150"
        className="h-auto w-full max-w-2xl overflow-visible select-none"
      >
        <title>Ruler with adjustable measurement cursor</title>

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
          {MINOR_TICKS_CM.map((cm) => {
            const isMajor = Number.isInteger(cm);
            const isHalf = Math.round(cm * 10) % 5 === 0;
            if (isMajor) return null;

            const tickLength = isHalf ? 20 : 12;
            const x = cmToX(cm);

            return (
              <line
                key={cm}
                x1={x}
                x2={x}
                y1={BASELINE_Y}
                y2={BASELINE_Y + tickLength}
                stroke="var(--foreground)"
                strokeOpacity={isHalf ? 0.48 : 0.3}
                strokeWidth={1}
              />
            );
          })}

          {MAJOR_TICKS_CM.map((cm) => {
            const x = cmToX(cm);

            return (
              <line
                key={cm}
                x1={x}
                x2={x}
                y1={BASELINE_Y}
                y2={BASELINE_Y + 30}
                stroke="var(--foreground)"
                strokeOpacity="0.68"
                strokeWidth="1.6"
              />
            );
          })}

          {MAJOR_TICKS_CM.map((cm) => (
            <text
              key={cm}
              x={cmToX(cm)}
              y={BAR_BOTTOM_Y + 18}
              textAnchor="middle"
              fill="var(--muted-foreground)"
              className="font-mono text-[12px]"
            >
              {cm}
            </text>
          ))}

          <text
            x={SCALE_RIGHT_X + 12}
            y={BAR_BOTTOM_Y + 18}
            textAnchor="start"
            fill="var(--muted-foreground)"
            className="font-mono text-[12px]"
          >
            cm
          </text>
        </g>

        <line
          x1={cursorX}
          x2={cursorX}
          y1={BASELINE_Y - 14}
          y2={BAR_BOTTOM_Y}
          stroke="var(--accent)"
          strokeWidth="2"
          aria-hidden="true"
        />
        <path
          d={`M ${cursorX - 7} ${BASELINE_Y - 14} L ${cursorX + 7} ${BASELINE_Y - 14} L ${cursorX} ${BASELINE_Y - 2} Z`}
          fill="var(--accent)"
          aria-hidden="true"
        />

        <g
          transform={`translate(${labelX - labelWidth / 2} ${BASELINE_Y - 46})`}
          aria-hidden="true"
        >
          <rect
            width={labelWidth}
            height="28"
            rx="14"
            fill="var(--card)"
            stroke="var(--accent)"
            strokeOpacity="0.55"
          />
          <text
            x={labelWidth / 2}
            y="18.5"
            textAnchor="middle"
            fill="var(--accent)"
            className="font-mono text-[13px] font-semibold"
          >
            {formattedValue} cm
          </text>
        </g>

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
          aria-label="Measured length"
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
      </svg>
    </div>
  );
}
