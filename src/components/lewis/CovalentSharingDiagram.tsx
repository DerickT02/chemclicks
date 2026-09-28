"use client";

import { useId, useState, type CSSProperties } from "react";
import {
  describeAtomElectronCount,
  describeDiagram,
  describeElectronSource,
  describeShellOverlap,
  describeSharing,
  describeValenceBeforeBonding,
  getAlternatingAtomGroups,
  getAtom,
  getAtomElectronCount,
  getBondSide,
  getFullShellSize,
  getUnpairedElectrons,
  type CovalentCompound,
  type Side,
  type UnpairedElectron,
} from "@/lib/chemistry/covalent-compounds";

type SharingStage = "apart" | "sharing" | "lewis";

const STAGES: readonly { id: SharingStage; label: string; next: string }[] = [
  { id: "apart", label: "Atoms apart", next: "Next: share electrons" },
  { id: "sharing", label: "Sharing", next: "Next: Lewis structure" },
  { id: "lewis", label: "Lewis structure", next: "Start over" },
];

/** Diagram units: distance between bonded atoms. */
const CELL = 96;
/** How far the atoms start from the molecule's centre, relative to their bonded positions. */
const SPREAD = 1.6;
/** Radius of the translucent outer shell drawn around each atom. */
const SHELL_RADIUS = 66;
/** Space kept around the outermost shells. */
const MARGIN = SHELL_RADIUS + 6;
const SYMBOL_SIZE = 30;
/** Distance from an atom's centre to its lone-pair dots. */
const LONE_PAIR_OFFSET = 26;
/** Half the gap between the two dots of one electron pair. */
const DOT_GAP = 7;
/** Spacing between neighbouring shared pairs in a double or triple bond. */
const PAIR_SPACING = 13;
const DOT_RADIUS = 4;
/** Opacity of electrons the focused atom does not count. */
const DIMMED_OPACITY = 0.15;

const LONE_PAIR_COLOR = "var(--electron)";
const SHARED_PAIR_COLOR = "var(--accent)";
/** Before the Lewis step, electrons are coloured by the atom they came from. */
const SOURCE_COLORS = ["var(--electron)", "var(--electron-partner)"] as const;
const SOURCE_SWATCHES = ["bg-electron", "bg-electron-partner"] as const;

/** Atoms, shells and electrons glide between steps. */
const MOTION = "transition-all duration-700 ease-in-out motion-reduce:transition-none";

type Point = { x: number; y: number };

type AtomPlacement = { apart: Point; bonded: Point };

type Electron = {
  id: string;
  /** The atom this electron came from. */
  atomId: string;
  apart: Point;
  bonded: Point;
  shared: boolean;
  /** Atoms that count this electron towards their outer shell. */
  countedBy: readonly string[];
};

const SIDE_VECTORS: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

function offset(point: Point, direction: Point, distance: number): Point {
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance };
}

/** Where the two dots of a pair sit relative to its centre, spread across `axis`. */
function pairOffsets(axis: Point): [Point, Point] {
  const across = { x: axis.y, y: axis.x };
  return [offset({ x: 0, y: 0 }, across, -DOT_GAP), offset({ x: 0, y: 0 }, across, DOT_GAP)];
}

function translate(point: Point): CSSProperties {
  return { transform: `translate(${point.x}px, ${point.y}px)` };
}

/** Bonded positions come from the grid; in the first step every atom is pushed out from the centre. */
function placeAtoms(compound: CovalentCompound): Record<string, AtomPlacement> {
  const centerX = compound.atoms.reduce((total, atom) => total + atom.x, 0) / compound.atoms.length;
  const centerY = compound.atoms.reduce((total, atom) => total + atom.y, 0) / compound.atoms.length;

  return Object.fromEntries(
    compound.atoms.map((atom) => [
      atom.id,
      {
        bonded: { x: atom.x * CELL, y: atom.y * CELL },
        apart: {
          x: (centerX + (atom.x - centerX) * SPREAD) * CELL,
          y: (centerY + (atom.y - centerY) * SPREAD) * CELL,
        },
      },
    ]),
  );
}

/**
 * Every valence electron with its spot in the separate atoms and in the finished molecule, so
 * each one can be followed as it moves into place.
 */
function getElectrons(compound: CovalentCompound, places: Record<string, AtomPlacement>): Electron[] {
  const lonePairs = compound.atoms.flatMap((atom) =>
    atom.lonePairSides.flatMap((side) => {
      const direction = SIDE_VECTORS[side];
      const place = places[atom.id];
      return pairOffsets(direction).map((dot, index) => ({
        id: `${atom.id}-${side}-${index}`,
        atomId: atom.id,
        apart: offset(offset(place.apart, direction, LONE_PAIR_OFFSET), dot, 1),
        bonded: offset(offset(place.bonded, direction, LONE_PAIR_OFFSET), dot, 1),
        shared: false,
        countedBy: [atom.id],
      }));
    }),
  );

  const unpaired: Record<string, UnpairedElectron[]> = Object.fromEntries(
    compound.atoms.map((atom) => [atom.id, getUnpairedElectrons(compound, atom.id)]),
  );
  const unpairedSide = (atomId: string, bondId: string, pair: number): Side => {
    const electron = unpaired[atomId].find((item) => item.bondId === bondId && item.pair === pair);
    if (!electron) {
      throw new Error(`No unpaired electron on ${atomId} for pair ${pair} of ${bondId}`);
    }
    return electron.side;
  };

  const sharedPairs = compound.bonds.flatMap((bond) => {
    const direction = SIDE_VECTORS[getBondSide(getAtom(compound, bond.from), getAtom(compound, bond.to))];
    const from = places[bond.from].bonded;
    const to = places[bond.to].bonded;
    const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const dots = pairOffsets(direction);

    // Pairs sit side by side along the bond, like H:H, O::O and N:::N. Each pair takes one
    // electron from each atom.
    return Array.from({ length: bond.order }, (_, pair) => {
      const center = offset(midpoint, direction, (pair - (bond.order - 1) / 2) * PAIR_SPACING);
      return [bond.from, bond.to].map((atomId, end) => ({
        id: `${bond.id}-${pair}-${end === 0 ? "a" : "b"}`,
        atomId,
        apart: offset(places[atomId].apart, SIDE_VECTORS[unpairedSide(atomId, bond.id, pair)], LONE_PAIR_OFFSET),
        bonded: offset(center, dots[end], 1),
        shared: true,
        countedBy: [bond.from, bond.to],
      }));
    }).flat();
  });

  return [...sharedPairs, ...lonePairs];
}

/** One frame that fits every step, so the diagram doesn't jump in size as the atoms move. */
function getViewBox(places: Record<string, AtomPlacement>) {
  const points = Object.values(places).flatMap((place) => [place.apart, place.bonded]);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - MARGIN;
  const minY = Math.min(...ys) - MARGIN;
  const width = Math.max(...xs) - Math.min(...xs) + MARGIN * 2;
  const height = Math.max(...ys) - Math.min(...ys) + MARGIN * 2;
  return { minX, minY, width, height };
}

function describeStage(compound: CovalentCompound, stage: SharingStage): string {
  switch (stage) {
    case "apart":
      return `${compound.name} before bonding: the atoms sit apart, each shown with its own valence electrons.`;
    case "sharing":
      return `${compound.name} bonding: the atoms' outer shells overlap and each shared pair sits in an overlap.`;
    case "lewis":
      return describeDiagram(compound);
  }
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-3 w-3 rounded-full ${swatch}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const CHIP_CLASS =
  "min-h-9 rounded-md border px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

function chipClass(isSelected: boolean): string {
  return `${CHIP_CLASS} ${
    isSelected
      ? "border-accent bg-accent/15 text-foreground"
      : "border-border bg-muted text-foreground hover:border-accent"
  }`;
}

type Props = {
  compound: CovalentCompound;
};

/**
 * Walks through covalent bonding in three steps: separate atoms with their valence electrons,
 * the atoms' outer shells overlapping so electrons pair up, and the finished Lewis structure.
 */
export default function CovalentSharingDiagram({ compound }: Props) {
  const [stage, setStage] = useState<SharingStage>("apart");
  // Remembers which molecule the focus belongs to, so switching molecules clears it.
  const [focus, setFocus] = useState<{ compoundId: string; atomId: string } | null>(null);
  const baseId = useId();
  const descriptionId = `${baseId}-description`;
  const countPromptId = `${baseId}-count-prompt`;

  const places = placeAtoms(compound);
  const electrons = getElectrons(compound, places);
  const groups = getAlternatingAtomGroups(compound);
  const { minX, minY, width, height } = getViewBox(places);

  const isBonded = stage !== "apart";
  const focusedAtomId =
    stage === "sharing" && focus?.compoundId === compound.id ? focus.atomId : null;
  const stageIndex = STAGES.findIndex((item) => item.id === stage);
  const nextStage = STAGES[(stageIndex + 1) % STAGES.length];

  return (
    <div className="flex flex-1 flex-col gap-5 pt-5">
      <ol aria-label="Steps" className="grid grid-cols-3 gap-1.5">
        {STAGES.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              aria-current={item.id === stage ? "step" : undefined}
              onClick={() => setStage(item.id)}
              className={`w-full ${chipClass(item.id === stage)}`}
            >
              <span className="text-muted-foreground">{index + 1}.</span> {item.label}
            </button>
          </li>
        ))}
      </ol>

      <figure className="flex flex-1 flex-col items-center justify-center gap-5">
        <svg
          key={compound.id}
          role="img"
          aria-label={describeStage(compound, stage)}
          aria-describedby={descriptionId}
          viewBox={`${minX} ${minY} ${width} ${height}`}
          width={width}
          height={height}
          className="h-auto max-w-full"
        >
          <g aria-hidden="true">
            {compound.atoms.map((atom) => {
              const isFocused = atom.id === focusedAtomId;
              return (
                <circle
                  key={atom.id}
                  r={SHELL_RADIUS}
                  fill={SHARED_PAIR_COLOR}
                  stroke={SHARED_PAIR_COLOR}
                  className={MOTION}
                  style={{
                    ...translate(isBonded ? places[atom.id].bonded : places[atom.id].apart),
                    opacity: stage === "lewis" ? 0 : 1,
                    fillOpacity: focusedAtomId ? (isFocused ? 0.22 : 0.04) : 0.1,
                    strokeOpacity: isFocused ? 1 : 0.45,
                    strokeWidth: isFocused ? 2 : 1,
                    strokeDasharray: isFocused ? "none" : "4 4",
                  }}
                />
              );
            })}

            {compound.atoms.map((atom) => (
              <text
                key={atom.id}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={SYMBOL_SIZE}
                fontWeight={700}
                fill="var(--foreground)"
                className={MOTION}
                style={translate(isBonded ? places[atom.id].bonded : places[atom.id].apart)}
              >
                {atom.symbol}
              </text>
            ))}

            {electrons.map((electron) => {
              const roleColor = electron.shared ? SHARED_PAIR_COLOR : LONE_PAIR_COLOR;
              const isCounted = !focusedAtomId || electron.countedBy.includes(focusedAtomId);
              return (
                <circle
                  key={electron.id}
                  r={DOT_RADIUS}
                  className={MOTION}
                  style={{
                    ...translate(isBonded ? electron.bonded : electron.apart),
                    fill: stage === "lewis" ? roleColor : SOURCE_COLORS[groups[electron.atomId]],
                    opacity: isCounted ? 1 : DIMMED_OPACITY,
                  }}
                />
              );
            })}
          </g>
        </svg>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {stage === "lewis" ? (
            <>
              <LegendItem swatch="bg-accent" label="Shared pair (bonding electrons)" />
              <LegendItem swatch="bg-electron" label="Lone pair (non-bonding electrons)" />
            </>
          ) : (
            <>
              <LegendItem swatch={SOURCE_SWATCHES[0]} label={describeElectronSource(compound, 0)} />
              <LegendItem swatch={SOURCE_SWATCHES[1]} label={describeElectronSource(compound, 1)} />
              <LegendItem swatch="border border-dashed border-accent bg-accent/10" label="Outer shell" />
            </>
          )}
        </div>

        {stage === "sharing" && (
          <div className="flex flex-col items-center gap-2">
            <p id={countPromptId} className="text-xs text-muted-foreground">
              Select an atom to count the electrons in its outer shell:
            </p>
            <div role="group" aria-labelledby={countPromptId} className="flex flex-wrap justify-center gap-1.5">
              {compound.atoms.map((atom) => {
                const isFocused = atom.id === focusedAtomId;
                const count = getAtomElectronCount(compound, atom.id);
                const full = getFullShellSize(atom);
                const sameElement = compound.atoms.filter((item) => item.symbol === atom.symbol);
                const name =
                  sameElement.length > 1
                    ? `${atom.elementName} ${sameElement.indexOf(atom) + 1}`
                    : atom.elementName;
                return (
                  <button
                    key={atom.id}
                    type="button"
                    aria-pressed={isFocused}
                    aria-label={`${name}: ${count} of ${full} electrons`}
                    onClick={() =>
                      setFocus(isFocused ? null : { compoundId: compound.id, atomId: atom.id })
                    }
                    className={chipClass(isFocused)}
                  >
                    {atom.symbol}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      {count}/{full}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <figcaption
          id={descriptionId}
          aria-live="polite"
          className="max-w-md space-y-2 text-center text-sm leading-relaxed text-muted-foreground"
        >
          {stage === "apart" && <p>{describeValenceBeforeBonding(compound)}</p>}
          {stage === "sharing" && (
            <>
              <p>{describeShellOverlap(compound)}</p>
              {focusedAtomId && (
                <p className="font-medium text-foreground">
                  {describeAtomElectronCount(compound, focusedAtomId)}
                </p>
              )}
            </>
          )}
          {stage === "lewis" && <p>{describeSharing(compound)}</p>}
        </figcaption>

        <button
          type="button"
          onClick={() => setStage(nextStage.id)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          {STAGES[stageIndex].next}
        </button>
      </figure>
    </div>
  );
}
