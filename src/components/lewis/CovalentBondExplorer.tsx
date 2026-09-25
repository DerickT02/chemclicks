"use client";

import { useId, useState, type ReactNode } from "react";
import CovalentSharingDiagram from "@/components/lewis/CovalentSharingDiagram";
import {
  COVALENT_BOND_GROUPS,
  COVALENT_COMPOUNDS,
  describeAtoms,
  describeBondOrder,
  describeBonds,
  describeLonePairs,
  getLonePairCount,
  getSharedPairCount,
} from "@/lib/chemistry/covalent-compounds";

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

        <CovalentSharingDiagram compound={compound} />

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Lewis diagrams are flat. They show how electrons are shared, not the molecule&apos;s
          3D shape or bond angles.
        </p>
      </section>
    </div>
  );
}
