"use client";

import { useId, useState } from "react";
import { ELEMENTS, type Element } from "@/lib/chemistry/elements";
import {
  getLewisDotPositions,
  type LewisDotPosition,
} from "@/lib/chemistry/lewis";

type DiagramSide = "top" | "right" | "bottom" | "left";

const SIDES: readonly DiagramSide[] = ["top", "right", "bottom", "left"];

const SIDE_CLASS_NAMES: Record<DiagramSide, string> = {
  top: "col-start-2 row-start-1 flex items-end justify-center gap-3 pb-2",
  right: "col-start-3 row-start-2 flex flex-col items-start justify-center gap-3 pl-2",
  bottom: "col-start-2 row-start-3 flex items-start justify-center gap-3 pt-2",
  left: "col-start-1 row-start-2 flex flex-col items-end justify-center gap-3 pr-2",
};

function positionsForSide(
  positions: readonly LewisDotPosition[],
  side: DiagramSide,
): readonly LewisDotPosition[] {
  return positions.filter((position) => position.startsWith(`${side}-`));
}

export default function LewisDotExplorer() {
  const [selectedAtomicNumber, setSelectedAtomicNumber] = useState(10);
  const descriptionId = useId();
  const selectedElement =
    ELEMENTS.find((element) => element.atomicNumber === selectedAtomicNumber) ??
    ELEMENTS[0];
  const dotPositions = getLewisDotPositions(selectedElement.valenceElectrons);
  const electronWord =
    selectedElement.valenceElectrons === 1 ? "electron" : "electrons";
  const description = `${selectedElement.name} has ${selectedElement.valenceElectrons} valence ${electronWord} in its outermost shell. The Lewis diagram shows these as dots around the symbol.`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <section className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Bohr Model</h2>

        <div
          role="group"
          aria-label="Choose an element"
          className="mt-5 grid grid-cols-5 gap-1.5 sm:grid-cols-10"
        >
          {ELEMENTS.map((element) => {
            const isSelected = element.atomicNumber === selectedElement.atomicNumber;

            return (
              <button
                key={element.atomicNumber}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${element.name}, ${element.symbol}`}
                onClick={() => setSelectedAtomicNumber(element.atomicNumber)}
                className={`min-h-9 rounded-md border px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border bg-muted text-foreground hover:border-accent"
                }`}
              >
                {element.symbol}
              </button>
            );
          })}
        </div>

        {/* <div className="mt-5 flex flex-1 items-center justify-center">
          <BohrModel element={selectedElement} />
        </div> */}

        <p className="mt-2 text-center text-xs font-medium text-accent">
          Valence electrons: {selectedElement.valenceElectrons}
        </p>
      </section>

      <section className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Lewis Diagram (Valence Only)
        </h2>

        <figure className="flex flex-1 flex-col items-center justify-center gap-6 pt-5">
          <div
            role="img"
            aria-label={`Lewis dot diagram for ${selectedElement.name}, showing ${selectedElement.valenceElectrons} valence ${electronWord}`}
            aria-describedby={descriptionId}
            className="grid aspect-square w-44 grid-cols-3 grid-rows-3"
          >
            {SIDES.map((side) => (
              <div
                key={side}
                aria-hidden="true"
                className={SIDE_CLASS_NAMES[side]}
              >
                {positionsForSide(dotPositions, side).map((position) => (
                  <span
                    key={position}
                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#60a5fa] shadow-[0_0_5px_rgba(96,165,250,0.35)]"
                  />
                ))}
              </div>
            ))}

            <span
              aria-hidden="true"
              className="col-start-2 row-start-2 flex items-center justify-center text-4xl font-bold text-foreground"
            >
              {selectedElement.symbol}
            </span>
          </div>

          <figcaption
            id={descriptionId}
            aria-live="polite"
            className="max-w-md text-center text-sm leading-relaxed text-muted-foreground"
          >
            {description}
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
