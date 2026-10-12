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
          <Link href="/student/labs" className="mb-4 inline-block text-sm text-foreground underline">Back to practice labs</Link>
          <p className="mb-4 text-sm text-muted-foreground">Untracked practice — exploring here does not record assignment completion.</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl" aria-hidden="true">⚛️</span>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Bohr Models</h1>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            In the Bohr model, electrons orbit the nucleus in concentric shells labeled{" "}
            <strong className="text-foreground">K, L, M,</strong> and <strong className="text-foreground">N</strong>.
            For the first 20 elements, electrons fill these shells in a 2, 8, 8, 2 pattern.
            Select any element below to see its model animate — then click a shell ring or shell reference
            card to explore that shell in detail.
          </p>
        </header>

        {/* Interactive viewer */}
        <BohrModelViewer />

      </div>
    </div>
  );
}
