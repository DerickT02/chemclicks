import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Labs — ChemClicks",
  description: "Interactive chemistry labs: Bohr Models, Lewis Structures, and Measurement.",
};

const LABS = [
  {
    href: "/student/labs/bohr-models",
    icon: "⚛️",
    title: "Bohr Models",
    description: "Learn about electron shells by exploring interactive atomic models for elements 1–20.",
    status: "available" as const,
  },
  {
    href: "/student/labs/lewis",
    icon: "🧪",
    title: "Lewis Structures",
    description: "Draw Lewis diagrams and explore covalent and ionic bonding.",
    status: "available" as const,
  },
  {
    href: "/student/labs/measurement",
    icon: "📏",
    title: "Measurement Lab",
    description: "Practice reading scales to tenths and hundredths using a graduated cylinder.",
    status: "available" as const,
  },
];

export default function LabsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">

        <header className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-1">Labs</h1>
          <p className="text-muted-foreground text-sm">
            Pick a lab below to start learning.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LABS.map((lab) => {
            const available = lab.status === "available";
            const card = (
              <div
                className={`flex flex-col gap-3 rounded-2xl border p-6 transition-all duration-150 h-full ${
                  available
                    ? "border-border bg-card hover:border-accent/50 hover:bg-accent/5 cursor-pointer"
                    : "border-border bg-card opacity-50 cursor-default"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-3xl">{lab.icon}</span>
                  {!available && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded-full px-2 py-0.5">
                      Coming soon
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">{lab.title}</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">{lab.description}</p>
                </div>
                {available && (
                  <span className="mt-auto text-xs font-semibold text-accent">
                    Start →
                  </span>
                )}
              </div>
            );

            return available ? (
              <Link key={lab.title} href={lab.href} className="flex">
                {card}
              </Link>
            ) : (
              <div key={lab.title} className="flex">
                {card}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
