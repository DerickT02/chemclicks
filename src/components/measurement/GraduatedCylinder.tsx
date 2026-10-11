"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CYLINDER_SPEC, formatReading, quantizeReading } from "@/lib/measurement/instruments";

const CAPACITY_ML = CYLINDER_SPEC.max;
const DEFAULT_ML = CYLINDER_SPEC.defaultReading;
const SCALE_TOP_Y = 46;
const SCALE_BOTTOM_Y = 390;
const SCALE_HEIGHT = SCALE_BOTTOM_Y - SCALE_TOP_Y;
const SCALE_ML = [0, 10, 20, 30, 40, 50];
export type CylinderPrecision = "whole" | "tenths";

const CYLINDER_SPECS = {
  whole: { ...CYLINDER_SPEC, graduation: 10, step: 1, decimals: 0 },
  tenths: CYLINDER_SPEC,
};
const CYLINDER_PATH =
  "M 105 30 L 105 390 Q 105 400 115 400 L 195 400 Q 205 400 205 390 L 205 30";

function volumeToY(ml: number): number {
  return SCALE_BOTTOM_Y - (ml / CAPACITY_ML) * SCALE_HEIGHT;
}

type Props = {
  precision?: CylinderPrecision;
  /** Shared physical level; display rounding must not move the water. */
  value?: number;
  onValueChange?: (value: number) => void;
  sliderLabel?: string;
  /**
   * Pin the water at this volume, in milliliters, for a question. The student
   * can't move it, and neither the readout nor assistive tech reveals the value.
   */
  lockedValue?: number;
};

export default function GraduatedCylinder({
  lockedValue, precision = "tenths", value, onValueChange, sliderLabel = "Water volume",
}: Props) {
  const [movableMl, setVolumeMl] = useState(DEFAULT_ML);
  const isLocked = lockedValue !== undefined;
  const spec = CYLINDER_SPECS[precision];
  const motionSpec = value !== undefined ? CYLINDER_SPEC : spec;
  const volumeMl = quantizeReading(lockedValue ?? value ?? movableMl, motionSpec);
  const graduations = Array.from({ length: CAPACITY_ML / spec.graduation + 1 }, (_, index) =>
    index * spec.graduation,
  );

  function updateVolume(ml: number) {
    const next = quantizeReading(ml, motionSpec);
    setVolumeMl(next);
    onValueChange?.(next);
  }

  const idPrefix = useId().replaceAll(":", "");
  const glassGradientId = `${idPrefix}-glass`;
  const waterGradientId = `${idPrefix}-water`;
  const baseGradientId = `${idPrefix}-base`;
  const cylinderClipId = `${idPrefix}-cylinder-clip`;

  function setFromPointer(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.height === 0) return;

    const position = 1 - (event.clientY - rect.top) / rect.height;
    updateVolume(position * CAPACITY_ML);
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
    const deltas: Record<string, number> = {
      ArrowLeft: -spec.step,
      ArrowDown: -spec.step,
      ArrowRight: spec.step,
      ArrowUp: spec.step,
      Home: -CAPACITY_ML,
      End: CAPACITY_ML,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    updateVolume(volumeMl + delta);
  }

  const meniscusY = volumeToY(volumeMl);
  const meniscusEdgeY = meniscusY - 5;
  const meniscusPath = `M 106 ${meniscusEdgeY} Q 155 ${meniscusY + 5} 204 ${meniscusEdgeY}`;
  const waterPath = `${meniscusPath} L 204 400 L 106 400 Z`;
  const labelY = meniscusY - 14;
  const formattedVolume = formatReading(volumeMl, spec);

  return (
    <div className="flex justify-center py-2">
      <svg
        viewBox="0 0 330 460"
        className="h-auto w-full max-w-[20rem] overflow-visible select-none"
        role={isLocked ? "img" : undefined}
      >
        <title>
          {isLocked
            ? "Graduated cylinder holding water"
            : "Graduated cylinder with adjustable water volume"}
        </title>
        <desc>
          Read the volume at the bottom of the meniscus, indicated by the arrow and horizontal guide line.
        </desc>
        <defs>
          <linearGradient id={glassGradientId} x1="0" x2="1">
            <stop offset="0" stopColor="#cbd5e1" stopOpacity="0.28" />
            <stop offset="0.16" stopColor="#f8fafc" stopOpacity="0.08" />
            <stop offset="0.5" stopColor="#f8fafc" stopOpacity="0.02" />
            <stop offset="0.84" stopColor="#f8fafc" stopOpacity="0.11" />
            <stop offset="1" stopColor="#94a3b8" stopOpacity="0.32" />
          </linearGradient>
          <linearGradient id={waterGradientId} x1="0" x2="1">
            <stop offset="0" stopColor="#0284c7" stopOpacity="0.62" />
            <stop offset="0.18" stopColor="#38bdf8" stopOpacity="0.48" />
            <stop offset="0.5" stopColor="#7dd3fc" stopOpacity="0.34" />
            <stop offset="0.82" stopColor="#38bdf8" stopOpacity="0.48" />
            <stop offset="1" stopColor="#0284c7" stopOpacity="0.62" />
          </linearGradient>
          <linearGradient id={baseGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cbd5e1" stopOpacity="0.2" />
            <stop offset="1" stopColor="#64748b" stopOpacity="0.28" />
          </linearGradient>
          <clipPath id={cylinderClipId}>
            <path d="M 105 31 L 105 390 Q 105 400 115 400 L 195 400 Q 205 400 205 390 L 205 31 Z" />
          </clipPath>
        </defs>

        {/* A low, attached pedestal is characteristic of a graduated cylinder. */}
        <path
          d="M 94 396 L 216 396 L 240 428 Q 243 433 235 435 L 75 435 Q 67 433 70 428 Z"
          fill={`url(#${baseGradientId})`}
          stroke="var(--muted-foreground)"
          strokeOpacity="0.55"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M 75 428 Q 155 436 235 428"
          fill="none"
          stroke="#cbd5e1"
          strokeOpacity="0.3"
          strokeWidth="1.25"
        />

        {/* Glass, water, and markings are layered to keep the cylinder transparent. */}
        <path
          d={`${CYLINDER_PATH} Z`}
          fill={`url(#${glassGradientId})`}
        />

        {volumeMl > 0 && (
          <g clipPath={`url(#${cylinderClipId})`}>
            <path d={waterPath} fill={`url(#${waterGradientId})`} />
            <path
              d={meniscusPath}
              fill="none"
              stroke="#7dd3fc"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        )}

        <g aria-hidden="true">
          {graduations.map((ml) => {
            const isMajor = ml % 10 === 0;
            const isHalf = ml % 5 === 0;
            const tickLength = isMajor ? 29 : isHalf ? 21 : 12;
            const y = volumeToY(ml);

            return (
              <line
                key={ml}
                x1="106"
                x2={106 + tickLength}
                y1={y}
                y2={y}
                stroke="var(--foreground)"
                strokeOpacity={isMajor ? 0.68 : isHalf ? 0.48 : 0.3}
                strokeWidth={isMajor ? 1.6 : 1}
              />
            );
          })}

          {SCALE_ML.map((ml) => (
            <text
              key={ml}
              x="88"
              y={volumeToY(ml) + 4}
              textAnchor="end"
              fill="var(--muted-foreground)"
              className="font-mono text-[12px]"
            >
              {ml}
            </text>
          ))}
        </g>

        <path
          d={CYLINDER_PATH}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeOpacity="0.7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 113 48 L 113 378"
          fill="none"
          stroke="#f8fafc"
          strokeOpacity="0.18"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* A shallow double ellipse suggests an open glass rim without a heavy cap. */}
        <ellipse
          cx="155"
          cy="30"
          rx="55"
          ry="8"
          fill="var(--card)"
          fillOpacity="0.28"
          stroke="var(--muted-foreground)"
          strokeOpacity="0.75"
          strokeWidth="2.5"
        />
        <ellipse
          cx="155"
          cy="30"
          rx="49"
          ry="4"
          fill="var(--background)"
          fillOpacity="0.35"
          stroke="#cbd5e1"
          strokeOpacity="0.4"
          strokeWidth="1"
        />

        {/* The curve's center is its lowest point and the level used to read the scale. */}
        {volumeMl > 0 && (
          <g aria-hidden="true" pointerEvents="none">
            <line
              x1="106"
              x2="218"
              y1={meniscusY}
              y2={meniscusY}
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <path
              d={`M 218 ${meniscusY - 7} L 218 ${meniscusY + 7} L 206 ${meniscusY} Z`}
              fill="var(--accent)"
            />
          </g>
        )}

        {/* A locked cylinder is a question, so neither the badge nor a slider may give away the volume. */}
        {!isLocked && (
          <>
            <g transform={`translate(234 ${labelY})`} aria-hidden="true">
              <rect
                width="84"
                height="28"
                rx="14"
                fill="var(--card)"
                stroke="var(--accent)"
                strokeOpacity="0.55"
              />
              <text
                x="42"
                y="18.5"
                textAnchor="middle"
                fill="var(--accent)"
                className="font-mono text-[16px] font-semibold"
              >
                {formattedVolume} mL
              </text>
            </g>

            <rect
              x="96"
              y={SCALE_TOP_Y}
              width="118"
              height={SCALE_HEIGHT}
              rx="8"
              fill="transparent"
              stroke="transparent"
              strokeWidth="3"
              className="cursor-ns-resize touch-none outline-none focus:stroke-[var(--ring)]"
              role="slider"
              tabIndex={0}
              aria-label={sliderLabel}
              aria-valuemin={0}
              aria-valuemax={CAPACITY_ML}
              aria-valuenow={volumeMl}
              aria-valuetext={`${formattedVolume} milliliters`}
              aria-orientation="vertical"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              onKeyDown={handleKeyDown}
            />
          </>
        )}
      </svg>
    </div>
  );
}
