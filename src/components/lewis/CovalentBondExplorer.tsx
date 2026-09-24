"use client";

import { useId, useState, type ReactNode } from "react";
import {
  COVALENT_BOND_GROUPS,
  COVALENT_COMPOUNDS,
  describeAtoms,
  describeBondOrder,
  describeBonds,
  describeDiagram,
  describeLonePairs,
  describeSharing,
  getAtom,
  getBondSide,
  getLonePairCount,
  getSharedPairCount,
  type CovalentCompound,
  type Side,
} from "@/lib/chemistry/covalent-compounds";

/** Diagram units: distance between bonded atoms, and the margin around the molecule. */
const CELL = 96;
const PADDING = 44;
const SYMBOL_SIZE = 30;
/** Distance from an atom's centre to its lone-pair dots. */
const LONE_PAIR_OFFSET = 26;
/** Half the gap between the two dots of one electron pair. */
const DOT_GAP = 7;
/** Spacing between neighbouring shared pairs in a double or triple bond. */
const PAIR_SPACING = 13;
const DOT_RADIUS = 4;

const LONE_PAIR_COLOR = "var(--electron)";
const SHARED_PAIR_COLOR = "var(--accent)";

type Point = { x: number; y: number };

type Dot = Point & { id: string; shared: boolean };

const SIDE_VECTORS: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** Two dots straddling `center`, spread along the direction perpendicular to `axis`. */
function electronPair(id: string, center: Point, axis: Point, shared: boolean): Dot[] {
  const across = { x: axis.y, y: axis.x };
  return [-1, 1].map((sign) => ({
    id: `${id}-${sign < 0 ? "a" : "b"}`,
    x: center.x + across.x * DOT_GAP * sign,
    y: center.y + across.y * DOT_GAP * sign,
    shared,
  }));
}

function getDiagramDots(compound: CovalentCompound): Dot[] {
  const lonePairs = compound.atoms.flatMap((atom) =>
    atom.lonePairSides.flatMap((side) => {
      const direction = SIDE_VECTORS[side];
      const center = {
        x: atom.x * CELL + direction.x * LONE_PAIR_OFFSET,
        y: atom.y * CELL + direction.y * LONE_PAIR_OFFSET,
      };
      return electronPair(`${atom.id}-${side}`, center, direction, false);
    }),
  );

  const sharedPairs = compound.bonds.flatMap((bond) => {
    const from = getAtom(compound, bond.from);
    const to = getAtom(compound, bond.to);
    const direction = SIDE_VECTORS[getBondSide(from, to)];
    const midpoint = { x: ((from.x + to.x) * CELL) / 2, y: ((from.y + to.y) * CELL) / 2 };

    // Pairs sit side by side along the bond, like H:H, O::O and N:::N.
    return Array.from({ length: bond.order }, (_, pair) => {
      const along = (pair - (bond.order - 1) / 2) * PAIR_SPACING;
      const center = { x: midpoint.x + direction.x * along, y: midpoint.y + direction.y * along };
      return electronPair(`${bond.id}-${pair}`, center, direction, true);
    }).flat();
  });

  return [...sharedPairs, ...lonePairs];
}

function MoleculeDiagram({
  compound,
  descriptionId,
}: {
  compound: CovalentCompound;
  descriptionId: string;
}) {
  const xs = compound.atoms.map((atom) => atom.x);
  const ys = compound.atoms.map((atom) => atom.y);
  const minX = Math.min(...xs) * CELL - PADDING;
  const minY = Math.min(...ys) * CELL - PADDING;
  const width = (Math.max(...xs) - Math.min(...xs)) * CELL + PADDING * 2;
  const height = (Math.max(...ys) - Math.min(...ys)) * CELL + PADDING * 2;

  return (
    <svg
      role="img"
      aria-label={describeDiagram(compound)}
      aria-describedby={descriptionId}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      width={width}
      height={height}
      className="h-auto max-w-full"
    >
      <g aria-hidden="true">
        {compound.atoms.map((atom) => (
          <text
            key={atom.id}
            x={atom.x * CELL}
            y={atom.y * CELL}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={SYMBOL_SIZE}
            fontWeight={700}
            fill="var(--foreground)"
          >
            {atom.symbol}
          </text>
        ))}
        {getDiagramDots(compound).map((dot) => (
          <circle
            key={dot.id}
            cx={dot.x}
            cy={dot.y}
            r={DOT_RADIUS}
            fill={dot.shared ? SHARED_PAIR_COLOR : LONE_PAIR_COLOR}
          />
        ))}
      </g>
    </svg>
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

export default function CovalentBondExplorer() {
  const [selectedId, setSelectedId] = useState(COVALENT_COMPOUNDS[0].id);
  const baseId = useId();
  const descriptionId = `${baseId}-description`;
  const compound =
    COVALENT_COMPOUNDS.find((item) => item.id === selectedId) ?? COVALENT_COMPOUNDS[0];
  const sharedPairs = getSharedPairCount(compound);
  const lonePairs = getLonePairCount(compound);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <section className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Example Molecules</h2>

        <div className="mt-5 space-y-4">
          {COVALENT_BOND_GROUPS.map((group) => {
            const headingId = `${baseId}-${group.bondType}`;
            const hintId = `${headingId}-hint`;

            return (
              <div
                key={group.bondType}
                role="group"
                aria-labelledby={headingId}
                aria-describedby={hintId}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 id={headingId} className="text-xs font-semibold text-foreground">
                    {group.label}
                  </h3>
                  <p id={hintId} className="text-xs text-muted-foreground">
                    {group.order} shared {group.order === 1 ? "pair" : "pairs"} per bond (
                    {group.order * 2} electrons)
                  </p>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {group.compounds.map((item) => {
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
              </div>
            );
          })}
        </div>

        <dl className="mt-5 divide-y divide-border rounded-xl border border-border bg-muted/50">
          <DetailRow label="Formula">{compound.formula}</DetailRow>
          <DetailRow label="Name">{compound.name}</DetailRow>
          <DetailRow label="Atoms">{describeAtoms(compound)}</DetailRow>
          <DetailRow label="Bond type">{describeBondOrder(compound.bondOrder)}</DetailRow>
          <DetailRow label="Bonds">{describeBonds(compound)}</DetailRow>
          <DetailRow label="Total shared pairs">
            {sharedPairs}
            <span className="ml-2 font-normal text-muted-foreground">
              ({sharedPairs * 2} electrons)
            </span>
          </DetailRow>
          <DetailRow label="Lone pairs">
            {lonePairs === 0 ? (
              "None"
            ) : (
              <>
                {lonePairs}
                <span className="ml-2 font-normal text-muted-foreground">
                  ({describeLonePairs(compound)})
                </span>
              </>
            )}
          </DetailRow>
        </dl>
      </section>

      <section className="flex min-h-[22rem] flex-col rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">How Electrons Are Shared</h2>

        <figure className="flex flex-1 flex-col items-center justify-center gap-6 pt-5">
          <MoleculeDiagram compound={compound} descriptionId={descriptionId} />

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent" />
              <span className="text-xs text-muted-foreground">Shared pair (bonding electrons)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-electron" />
              <span className="text-xs text-muted-foreground">
                Lone pair (non-bonding electrons)
              </span>
            </div>
          </div>

          <figcaption
            id={descriptionId}
            aria-live="polite"
            className="max-w-md text-center text-sm leading-relaxed text-muted-foreground"
          >
            {describeSharing(compound)}
          </figcaption>
        </figure>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Lewis diagrams are flat. They show how electrons are shared, not the molecule&apos;s
          3D shape or bond angles.
        </p>
      </section>
    </div>
  );
}
