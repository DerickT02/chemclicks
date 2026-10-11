"use client";

import { useCallback, useId, useState } from "react";
import GraduatedCylinder from "@/components/measurement/GraduatedCylinder";
import PrecisionRuler from "@/components/measurement/PrecisionRuler";
import { INSTRUMENTS, type InstrumentId } from "@/lib/measurement/instruments";

type Props = {
  instrument: InstrumentId;
};

export default function MeasurementComparison({ instrument }: Props) {
  const [showComparison, setShowComparison] = useState(false);
  const [value, setValue] = useState(INSTRUMENTS[instrument].defaultReading);
  const id = useId();
  const focusNewScale = useCallback((node: HTMLHeadingElement | null) => {
    node?.focus();
  }, []);
  const isRuler = instrument === "ruler";
  const coarseTitle = isRuler ? "Ruler — Tenths" : "Cylinder — Whole milliliters";
  const fineTitle = isRuler ? "Ruler — Hundredths" : "Cylinder — Tenths of a milliliter";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isRuler
          ? "Drag the cursor, or focus it and use the arrow keys, to measure to the nearest tenth of a centimeter."
          : "Read at the bottom of the meniscus. Drag the water level, or focus it and use the arrow keys, to measure to the nearest whole milliliter."}
      </p>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {showComparison
          ? isRuler
            ? "Both pointers mark the same length. The finer ruler has marks every 0.1 cm, so you can estimate to 0.01 cm instead of 0.1 cm. Move either pointer to compare their precision."
            : "Both cylinders hold the same volume. The finer cylinder has marks every 1 mL, so you can estimate to 0.1 mL instead of 1 mL. Move either water level to compare their precision."
          : "Explore this scale first, then click Next to compare it with a more precise scale."}
      </p>
      <div className="overflow-x-auto">
        <div className={isRuler || !showComparison ? "space-y-4" : "grid min-w-lg grid-cols-2 gap-6"}>
          <section aria-labelledby={`${id}-coarse`} className="min-w-0">
            <h3 id={`${id}-coarse`} className="text-sm font-semibold text-foreground">{coarseTitle}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRuler ? "Marks every 1 cm · Read to 0.1 cm" : "Marks every 10 mL · Read to 1 mL"}
            </p>
            {isRuler ? (
              <PrecisionRuler precision="tenths" value={value} onValueChange={setValue} sliderLabel="Tenths ruler length" />
            ) : (
              <GraduatedCylinder precision="whole" value={value} onValueChange={setValue} sliderLabel="Whole milliliter cylinder volume" />
            )}
          </section>
          {showComparison && (
            <section aria-labelledby={`${id}-fine`} className="min-w-0">
              <h3 ref={focusNewScale} tabIndex={-1} id={`${id}-fine`} className="text-sm font-semibold text-foreground outline-none">{fineTitle}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {isRuler ? "Marks every 0.1 cm · Read to 0.01 cm" : "Marks every 1 mL · Read to 0.1 mL"}
              </p>
              {isRuler ? (
                <PrecisionRuler precision="hundredths" value={value} onValueChange={setValue} sliderLabel="Hundredths ruler length" />
              ) : (
                <GraduatedCylinder precision="tenths" value={value} onValueChange={setValue} sliderLabel="Tenths milliliter cylinder volume" />
              )}
            </section>
          )}
        </div>
      </div>
      {!showComparison && (
        <button
          type="button"
          onClick={() => setShowComparison(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Next
        </button>
      )}
    </div>
  );
}
