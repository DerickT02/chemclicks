"use client";

import { useId, useState, type ReactNode } from "react";
import { getLewisDotPositions, type LewisDotPosition } from "@/lib/chemistry/lewis";
import {
  IONIC_COMPOUNDS,
  describeChargeBalance,
  describeFormation,
  describeIon,
  formatChargeLabel,
  formatChargeValue,
  formatIonSymbol,
  formatSignedTotalCharge,
  getAtomRatio,
  getChargeTotals,
  getFormulaUnitIons,
  getIsolatedIons,
  getTransferredElectrons,
  ION_VOCABULARY,
  isChargeBalanced,
  type Ion,
  type IonicCompound,
  type IonRole,
} from "@/lib/chemistry/ionic-compounds";

type DiagramSide = "top" | "right" | "bottom" | "left";

const SIDES: readonly DiagramSide[] = ["top", "right", "bottom", "left"];

const SIDE_CLASS_NAMES: Record<DiagramSide, string> = {
  top: "col-start-2 row-start-1 flex items-end justify-center pb-1.5",
  right: "col-start-3 row-start-2 flex flex-col items-start justify-center pl-1.5",
  bottom: "col-start-2 row-start-3 flex items-start justify-center pt-1.5",
  left: "col-start-1 row-start-2 flex flex-col items-end justify-center pr-1.5",
};

type TileSize = "md" | "sm";

/**
 * "md" shrinks to the "sm" size inside a container narrower than 20rem, so the
 * formation diagram's tile → ion row still fits a phone-width card.
 */
const TILE_CLASS_NAMES: Record<TileSize, { tile: string; side: string; dot: string; symbol: string }> = {
  md: {
    tile: "w-20 @xs:w-28",
    side: "gap-1 @xs:gap-2",
    dot: "h-2 w-2 @xs:h-2.5 @xs:w-2.5",
    symbol: "text-xl @xs:text-2xl",
  },
  sm: { tile: "w-20", side: "gap-1", dot: "h-2 w-2", symbol: "text-xl" },
};

type PlacedDot = { position: LewisDotPosition; gained: boolean };

function dotsForSide(dots: readonly PlacedDot[], side: DiagramSide): readonly PlacedDot[] {
  return dots.filter((dot) => dot.position.startsWith(`${side}-`));
}

function LewisTile({
  symbol,
  keptElectrons,
  gainedElectrons = 0,
  size = "md",
}: {
  symbol: string;
  keptElectrons: number;
  gainedElectrons?: number;
  size?: TileSize;
}) {
  const sizeClassNames = TILE_CLASS_NAMES[size];
  const dots: readonly PlacedDot[] = getLewisDotPositions(
    keptElectrons + gainedElectrons,
  ).map((position, index) => ({ position, gained: index >= keptElectrons }));

  return (
    <div className={`grid aspect-square shrink-0 grid-cols-3 grid-rows-3 ${sizeClassNames.tile}`}>
      {SIDES.map((side) => (
        <div key={side} className={`${SIDE_CLASS_NAMES[side]} ${sizeClassNames.side}`}>
          {dotsForSide(dots, side).map((dot) => (
            <span
              key={dot.position}
              className={`shrink-0 rounded-full ${sizeClassNames.dot} ${
                dot.gained
                  ? "bg-accent shadow-[0_0_5px_var(--accent)]"
                  : "bg-[#60a5fa] shadow-[0_0_5px_rgba(96,165,250,0.35)]"
              }`}
            />
          ))}
        </div>
      ))}

      <span
        className={`col-start-2 row-start-2 flex items-center justify-center font-bold text-foreground ${sizeClassNames.symbol}`}
      >
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

/** An ion after electron transfer: its Lewis tile in brackets with the charge attached. */
function BracketedIon({
  ion,
  role,
  size = "md",
}: {
  ion: Ion;
  role: IonRole;
  size?: TileSize;
}) {
  const isCation = role === "cation";

  return (
    <>
      {/* The charge label sits in the flow, not absolutely, so it takes up room and never spills past its container. */}
      <div aria-hidden="true" className="flex shrink-0 items-start">
        <div className="rounded-sm border-x-2 border-muted-foreground/60 px-1">
          <LewisTile
            symbol={ion.symbol}
            keptElectrons={isCation ? 0 : ion.valenceElectrons}
            gainedElectrons={isCation ? 0 : Math.abs(ion.charge)}
            size={size}
          />
        </div>
        <span className="-mt-2 ml-0.5 text-sm font-semibold text-foreground">
          {formatChargeLabel(ion.charge)}
        </span>
      </div>
      <span className="sr-only">{describeIon(ion)}</span>
    </>
  );
}

function ComparisonPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-muted/50 p-4"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        <h3 id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

/** The ions on their own beside the same ions combined into one neutral formula unit. */
function IonComparison({ compound }: { compound: IonicCompound }) {
  const headingId = useId();
  const { cation, anion } = compound;
  const name = compound.name.toLowerCase();
  const { net } = getChargeTotals(compound);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-2"
    >
      <h2 id={headingId} className="text-sm font-semibold text-muted-foreground">
        Isolated Ions vs. Combined Compound
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ComparisonPanel eyebrow="Before combining" title="Isolated ions">
          <ul
            aria-label={`Isolated ions in ${name}`}
            className="flex flex-wrap items-start justify-center gap-x-8 gap-y-4"
          >
            {getIsolatedIons(compound).map(({ id, role, ion }) => (
              <li key={id} className="flex flex-col items-center gap-2">
                <div className="flex">
                  <BracketedIon ion={ion} role={role} size="sm" />
                </div>
                <span aria-hidden="true" className="text-center text-xs font-medium text-muted-foreground">
                  {ion.ionName} ion · charge {formatChargeValue(ion.charge)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Each ion carries its own charge, so neither one is neutral by itself.
          </p>
        </ComparisonPanel>

        <ComparisonPanel eyebrow="After combining" title="Combined neutral compound">
          <p className="text-xs font-medium text-muted-foreground">
            One formula unit of {compound.formula}
          </p>
          <ul
            aria-label={`Ions in one formula unit of ${name}`}
            className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3 rounded-xl border-2 border-dashed border-accent/40 p-3"
          >
            {getFormulaUnitIons(compound).map(({ id, role, ion }) => (
              <li key={id} className="flex">
                <BracketedIon ion={ion} role={role} size="sm" />
              </li>
            ))}
          </ul>
          <div className="space-y-1 text-center text-xs text-muted-foreground">
            <p>
              Ion ratio {cation.symbol} : {anion.symbol} ={" "}
              {getAtomRatio(compound).replace(":", " : ")}
            </p>
            <p>Charge balance {describeChargeBalance(compound)}</p>
            <p aria-live="polite" className="text-sm font-semibold text-accent">
              {compound.formula} net charge {formatSignedTotalCharge(net)} —{" "}
              {isChargeBalanced(compound) ? "electrically neutral" : "not neutral"}
            </p>
          </div>
        </ComparisonPanel>
      </div>
    </section>
  );
}

function IonColumn({ ion, role }: { ion: Ion; role: IonRole }) {
  const isCation = role === "cation";
  const electronsMoved = Math.abs(ion.charge);
  const electronLabel = electronsMoved === 1 ? "electron" : "electrons";

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-medium text-muted-foreground">
        {isCation ? "Cation (metal)" : "Anion (nonmetal)"}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <LewisTile symbol={ion.symbol} keptElectrons={ion.valenceElectrons} />

        <span aria-hidden="true" className="text-xl text-muted-foreground">
          →
        </span>

        <BracketedIon ion={ion} role={role} />
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
  const chargeTotals = getChargeTotals(compound);
  const vocabularyId = `${descriptionId}-vocab`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <section className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Example Salts</h2>

        <section
          aria-labelledby={vocabularyId}
          className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground"
        >
          <h3 id={vocabularyId} className="text-sm font-semibold text-foreground">
            Ion vocabulary
          </h3>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="font-medium text-foreground">Cation</dt>
              <dd>{ION_VOCABULARY.cation}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Anion</dt>
              <dd>{ION_VOCABULARY.anion}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Ionic charge</dt>
              <dd>{ION_VOCABULARY.ionicCharge}</dd>
            </div>
          </dl>
        </section>

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
          <DetailRow label="Ion ratio">
            {cation.symbol} : {anion.symbol} = {getAtomRatio(compound).replace(":", " : ")}
          </DetailRow>
          <DetailRow label="Charge balance">{describeChargeBalance(compound)}</DetailRow>
        </dl>

        <section
          aria-label="Charge summary for this formula unit"
          aria-live="polite"
          className="mt-5 rounded-xl border border-border bg-muted/50 p-4"
        >
          <h3 className="text-sm font-semibold text-foreground">Charge summary</h3>
          <dl className="mt-3 divide-y divide-border text-sm">
            <div className="flex items-start justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">Total positive charge</dt>
              <dd className="font-semibold text-foreground">
                {formatSignedTotalCharge(chargeTotals.totalPositive)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">Total negative charge</dt>
              <dd className="font-semibold text-foreground">
                {formatSignedTotalCharge(chargeTotals.totalNegative)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">Net charge</dt>
              <dd className="font-semibold text-foreground">
                {formatSignedTotalCharge(chargeTotals.net)}
              </dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">How the Ions Form</h2>

        <figure className="@container flex flex-1 flex-col items-center justify-center gap-6 pt-5">
          <div
            role="img"
            aria-label={`Diagram of ${compound.name.toLowerCase()}: ${transferred} ${transferred === 1 ? "electron moves" : "electrons move"} from ${cation.elementName.toLowerCase()} to ${anion.elementName.toLowerCase()}. Result: ${describeIon(cation)}; ${describeIon(anion)}.`}
            aria-describedby={descriptionId}
            className="grid w-full grid-cols-1 gap-8 @2xl:grid-cols-2 @2xl:gap-4"
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
            {/* Coefficients of 1 are left unwritten, as in any balanced equation. */}
            {cation.count > 1 && `${cation.count} `}
            {formatIonSymbol(cation)} + {anion.count > 1 && `${anion.count} `}
            {formatIonSymbol(anion)} → {compound.formula}
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

      <IonComparison compound={compound} />
    </div>
  );
}
