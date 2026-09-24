"use client";

import { useId, useState, type ReactNode } from "react";
import { getLewisDotPositions, type LewisDotPosition } from "@/lib/chemistry/lewis";
import {
  IONIC_COMPOUNDS,
  describeChargeBalance,
  describeFormation,
  describeIon,
  formatCharge,
  formatChargeValue,
  formatIonSymbol,
  getAtomRatio,
  getTransferredElectrons,
  type Ion,
} from "@/lib/chemistry/ionic-compounds";

type DiagramSide = "top" | "right" | "bottom" | "left";

const SIDES: readonly DiagramSide[] = ["top", "right", "bottom", "left"];

const SIDE_CLASS_NAMES: Record<DiagramSide, string> = {
  top: "col-start-2 row-start-1 flex items-end justify-center gap-2 pb-1.5",
  right: "col-start-3 row-start-2 flex flex-col items-start justify-center gap-2 pl-1.5",
  bottom: "col-start-2 row-start-3 flex items-start justify-center gap-2 pt-1.5",
  left: "col-start-1 row-start-2 flex flex-col items-end justify-center gap-2 pr-1.5",
};

type PlacedDot = { position: LewisDotPosition; gained: boolean };

function dotsForSide(dots: readonly PlacedDot[], side: DiagramSide): readonly PlacedDot[] {
  return dots.filter((dot) => dot.position.startsWith(`${side}-`));
}

function LewisTile({
  symbol,
  keptElectrons,
  gainedElectrons = 0,
}: {
  symbol: string;
  keptElectrons: number;
  gainedElectrons?: number;
}) {
  const dots: readonly PlacedDot[] = getLewisDotPositions(
    keptElectrons + gainedElectrons,
  ).map((position, index) => ({ position, gained: index >= keptElectrons }));

  return (
    <div className="grid aspect-square w-28 grid-cols-3 grid-rows-3">
      {SIDES.map((side) => (
        <div key={side} className={SIDE_CLASS_NAMES[side]}>
          {dotsForSide(dots, side).map((dot) => (
            <span
              key={dot.position}
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                dot.gained
                  ? "bg-accent shadow-[0_0_5px_var(--accent)]"
                  : "bg-[#60a5fa] shadow-[0_0_5px_rgba(96,165,250,0.35)]"
              }`}
            />
          ))}
        </div>
      ))}

      <span className="col-start-2 row-start-2 flex items-center justify-center text-2xl font-bold text-foreground">
        {symbol}
      </span>
    </div>
  );
}

function IonSymbol({ ion }: { ion: Ion }) {
  return (
    <>
      <span aria-hidden="true">{formatIonSymbol(ion)}</span>
      <span className="sr-only">{describeIon(ion)}</span>
    </>
  );
}

function IonColumn({ ion, role }: { ion: Ion; role: "cation" | "anion" }) {
  const isCation = role === "cation";
  const electronsMoved = Math.abs(ion.charge);
  const electronLabel = electronsMoved === 1 ? "electron" : "electrons";

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-medium text-muted-foreground">
        {isCation ? "Cation (metal)" : "Anion (nonmetal)"}
      </p>

      <div className="flex items-center gap-2">
        <LewisTile symbol={ion.symbol} keptElectrons={ion.valenceElectrons} />

        <span aria-hidden="true" className="text-xl text-muted-foreground">
          →
        </span>

        <div className="relative rounded-sm border-x-2 border-muted-foreground/60 px-1">
          <LewisTile
            symbol={ion.symbol}
            keptElectrons={isCation ? 0 : ion.valenceElectrons}
            gainedElectrons={isCation ? 0 : electronsMoved}
          />
          <span className="absolute -right-4 -top-2 text-sm font-semibold text-foreground">
            {formatCharge(ion.charge)}
          </span>
        </div>
      </div>

      <p className="text-center text-xs font-medium text-accent">
        {isCation ? "Gives up" : "Gains"} {electronsMoved} {electronLabel} per atom
      </p>
      <p className="rounded-full border border-accent/30 bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
        × {ion.count} in each formula unit
      </p>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{children}</dd>
    </div>
  );
}

export default function IonicCompoundExplorer() {
  const [selectedId, setSelectedId] = useState(IONIC_COMPOUNDS[0].id);
  const descriptionId = useId();
  const compound =
    IONIC_COMPOUNDS.find((item) => item.id === selectedId) ?? IONIC_COMPOUNDS[0];
  const { cation, anion } = compound;
  const transferred = getTransferredElectrons(compound);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <section className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Example Salts</h2>

        <div
          role="group"
          aria-label="Choose an example salt"
          className="mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
        >
          {IONIC_COMPOUNDS.map((item) => {
            const isSelected = item.id === compound.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${item.name}, ${item.plainFormula}`}
                onClick={() => setSelectedId(item.id)}
                className={`min-h-9 rounded-md border px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border bg-muted text-foreground hover:border-accent"
                }`}
              >
                {item.formula}
              </button>
            );
          })}
        </div>

        <dl className="mt-5 divide-y divide-border rounded-xl border border-border bg-muted/50">
          <DetailRow label="Formula">{compound.formula}</DetailRow>
          <DetailRow label="Compound name">{compound.name}</DetailRow>
          <DetailRow label="Cation">
            <IonSymbol ion={cation} />
            <span className="ml-2 font-normal text-muted-foreground">
              <span aria-hidden="true">
                {cation.ionName} ion, charge {formatChargeValue(cation.charge)},{" "}
              </span>
              count {cation.count}
            </span>
          </DetailRow>
          <DetailRow label="Anion">
            <IonSymbol ion={anion} />
            <span className="ml-2 font-normal text-muted-foreground">
              <span aria-hidden="true">
                {anion.ionName} ion, charge {formatChargeValue(anion.charge)},{" "}
              </span>
              count {anion.count}
            </span>
          </DetailRow>
          <DetailRow label="Atom ratio">
            {cation.symbol} : {anion.symbol} = {getAtomRatio(compound).replace(":", " : ")}
          </DetailRow>
          <DetailRow label="Charge balance">{describeChargeBalance(compound)}</DetailRow>
        </dl>
      </section>

      <section className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">How the Ions Form</h2>

        <figure className="flex flex-1 flex-col items-center justify-center gap-6 pt-5">
          <div
            role="img"
            aria-label={`Diagram of ${compound.name.toLowerCase()}: ${transferred} ${transferred === 1 ? "electron moves" : "electrons move"} from ${cation.elementName.toLowerCase()} to ${anion.elementName.toLowerCase()}. Result: ${describeIon(cation)}; ${describeIon(anion)}.`}
            aria-describedby={descriptionId}
            className="grid w-full grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-4"
          >
            <IonColumn ion={cation} role="cation" />
            <IonColumn ion={anion} role="anion" />
          </div>

          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#60a5fa]" />
              <span className="text-xs text-muted-foreground">Valence electron (e⁻)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent" />
              <span className="text-xs text-muted-foreground">Electron gained</span>
            </div>
          </div>

          <p aria-hidden="true" className="text-center text-base font-semibold text-foreground">
            {cation.count} {formatIonSymbol(cation)} + {anion.count} {formatIonSymbol(anion)} →{" "}
            {compound.formula}
          </p>

          <figcaption
            id={descriptionId}
            aria-live="polite"
            className="max-w-md text-center text-sm leading-relaxed text-muted-foreground"
          >
            {describeFormation(compound)}
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
