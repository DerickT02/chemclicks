"use client";

import CovalentSharingDiagram from "@/components/lewis/CovalentSharingDiagram";
import { COVALENT_COMPOUNDS } from "@/lib/chemistry/covalent-compounds";

type Props = {
  diagramKey: string;
};

/** Resolves quiz metadata to the same live diagram used by the covalent explorer. */
export default function CovalentQuizDiagram({ diagramKey }: Props) {
  const compound = COVALENT_COMPOUNDS.find((item) => item.id === diagramKey);
  if (!compound) return null;

  return (
    <section
      aria-label={`${compound.name} diagram`}
      className="mt-6 rounded-xl border border-border bg-muted/30 p-4 sm:p-6"
    >
      <CovalentSharingDiagram key={compound.id} compound={compound} />
    </section>
  );
}
