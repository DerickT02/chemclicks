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
          <h1 className="text-3xl font-semibold text-foreground">Measurement Lab</h1>
          <p className="text-sm text-muted-foreground">
            Ready to test yourself?{" "}
            <Link
              href="/student/labs/measurement/questions"
              className="rounded-sm font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Practice measurement questions
            </Link>
          </p>
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
