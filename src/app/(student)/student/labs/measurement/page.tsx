import type { Metadata } from "next";
import Link from "next/link";
import MeasurementComparison from "@/components/measurement/MeasurementComparison";

export const metadata: Metadata = {
  title: "Measurement Lab | ChemClicks",
  description: "Compare ruler and graduated cylinder scales to explore measurement precision.",
};

// Activities must be opened through a class assignment with server access checks.
export default function MeasurementLabPage() {
  return (
    <div className="min-h-screen-below-nav bg-background px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link href="/student/labs" className="text-sm text-foreground underline">Back to practice labs</Link>
          <p className="text-sm text-muted-foreground">Untracked practice — exploring here does not record assignment completion.</p>
          <h1 className="text-3xl font-semibold text-foreground">Measurement Lab</h1>
        </header>

        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold text-foreground">Ruler</h2>
          <MeasurementComparison instrument="ruler" />
        </article>

        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold text-foreground">Graduated Cylinder</h2>
          <MeasurementComparison instrument="cylinder" />
        </article>
      </div>
    </div>
  );
}
