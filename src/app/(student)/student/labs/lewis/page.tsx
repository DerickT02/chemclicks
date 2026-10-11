import type { Metadata } from "next";
import Link from "next/link";
import LewisDotExplorer from "@/components/lewis/LewisDotExplorer";
import IonicCompoundExplorer from "@/components/lewis/IonicCompoundExplorer";
import CovalentBondExplorer from "@/components/lewis/CovalentBondExplorer";
import { getLewisQuizAccess } from "@/lib/assignments/lewis-quiz-access";
import { LEWIS_QUIZZES, type LewisQuizKind } from "@/lib/assignments/lewis-quizzes";

export const metadata: Metadata = {
  title: "Lewis Structures — ChemClicks",
  description:
    "Explore Lewis diagrams for elements 1–20, then see how atoms form ionic and covalent bonds.",
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

export default async function LewisDotDiagramsPage() {
  const kinds: LewisQuizKind[] = ["covalent", "ionic"];
  const quizzes = await Promise.all(kinds.map(async (kind) => ({
    ...LEWIS_QUIZZES[kind],
    access: await getLewisQuizAccess(kind),
  })));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Page header */}
        <header className="mb-10">
          <Link href="/student/labs" className="mb-4 inline-block text-sm text-foreground underline">
            Back to practice labs
          </Link>
          <p className="mb-4 text-sm text-muted-foreground">
            Untracked practice — exploring here does not record assignment completion.
          </p>
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

        <section className="mt-10" aria-labelledby="lewis-quizzes">
          <h2 id="lewis-quizzes" className="text-xl font-semibold text-foreground">Check your understanding</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Quizzes are available while the matching class lesson is open. Your score is saved for your teacher when you finish.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {quizzes.map(({ title, path, access }) => (
              <article key={path} className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {access.status === "available" ? "Available now."
                    : access.status === "scheduled" ? "Your lesson is scheduled but not open yet."
                    : access.status === "closed" ? "Your lesson is closed; this quiz is unavailable."
                    : access.status === "error" ? access.message
                    : access.status === "unauthenticated" ? "Sign in to check your class assignments."
                    : "The matching lesson has not been assigned to your class."}
                </p>
                {access.status === "available" ? (
                  <Link href={path} className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                    Start quiz
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
          <Link href="/student" className="mt-4 inline-block text-sm text-foreground underline">
            Back to assignments
          </Link>
        </section>

      </div>
    </div>
  );
}
