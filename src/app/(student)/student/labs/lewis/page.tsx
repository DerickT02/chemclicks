import type { Metadata } from "next";
import Link from "next/link";
import LewisDotExplorer from "@/components/lewis/LewisDotExplorer";
import IonicCompoundExplorer from "@/components/lewis/IonicCompoundExplorer";
import CovalentBondExplorer from "@/components/lewis/CovalentBondExplorer";

export const metadata: Metadata = {
  title: "Lewis Structures — ChemClicks",
  description:
    "Draw Lewis diagrams for elements 1–20, then explore how atoms form ionic and covalent bonds.",
};

const SECTIONS = [
  {
    id: "lewis-diagrams",
    title: "Lewis Diagrams",
    description: "A Lewis diagram shows only the valence electrons from the Bohr model.",
    Explorer: LewisDotExplorer,
  },
  {
    id: "ionic-bonds",
    title: "Ionic Bonds",
    description: "Metals transfer electrons to nonmetals, forming ions with full outer shells.",
    Explorer: IonicCompoundExplorer,
  },
  {
    id: "covalent-bonds",
    title: "Covalent Bonds",
    description: "Nonmetals share pairs of electrons so every atom reaches a full outer shell.",
    Explorer: CovalentBondExplorer,
  },
];

export default function LewisDotDiagramsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Page header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl" aria-hidden="true">🧪</span>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Lewis Structures</h1>
              <p className="text-muted-foreground text-sm">Valence Electrons and Chemical Bonds</p>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            Start with the Lewis diagram of a single atom, then see how atoms use their valence
            electrons to bond — by transferring them in ionic compounds or sharing them in
            covalent molecules.
          </p>
        </header>

        {/* Interactive explorers */}
        <div className="flex flex-col gap-12">
          {SECTIONS.map(({ id, title, description, Explorer }) => (
            <section key={id} aria-labelledby={id} className="flex flex-col gap-4">
              <div>
                <h2 id={id} className="text-xl font-semibold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <Explorer />
            </section>
          ))}
        </div>

        {/* Quiz CTA */}
        <div className="mt-10 flex justify-center">
          <Link
            href="/student/quizzes/lewis"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Go to quiz →
          </Link>
        </div>

      </div>
    </div>
  );
}
