import type { Metadata } from "next";
import Link from "next/link";
import BohrModelViewer from "@/components/bohr-models/BohrModelViewer";

export const metadata: Metadata = {
  title: "Bohr Models — ChemClicks",
  description:
    "Introduction to electron shells. Explore interactive Bohr atomic models for elements 1–20.",
};

export default function BohrModelsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Page header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl" aria-hidden="true">⚛️</span>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Bohr Models</h1>
              <p className="text-muted-foreground text-sm">Introduction to Electron Shells</p>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            In the Bohr model, electrons orbit the nucleus in concentric shells labeled{" "}
            <strong className="text-foreground">K, L, M,</strong> and <strong className="text-foreground">N</strong>.
            Each shell has a maximum capacity (2, 8, 8, 2 for the first 20 elements).
            Select any element below to see its model animate — then click a shell ring or configuration
            chip to explore that shell in detail.
          </p>
        </header>

        {/* Interactive viewer */}
        <BohrModelViewer />

        {/* Quiz CTA */}
        <div className="mt-10 flex justify-center">
          <Link
            href="/student/quizzes/bohr"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Go to quiz →
          </Link>
        </div>

      </div>
    </div>
  );
}
