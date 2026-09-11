"use client";

const KEY_CONCEPTS = [
  {
    icon: "🔵",
    title: "Electron (e⁻)",
    body: "Negatively charged particles that orbit the nucleus in fixed shells. Each element has as many electrons as protons.",
  },
  {
    icon: "⚡",
    title: "Valence Electrons",
    body: "Electrons in the outermost shell. They determine how an element bonds and reacts with other elements.",
  },
  {
    icon: "🏠",
    title: "Shell Capacity",
    body: "The K shell holds up to 2 electrons. The L and M shells hold up to 8. The N shell holds 2 for elements 1–20.",
  },
  {
    icon: "🛡️",
    title: "Stability",
    body: "Noble gases (He, Ne, Ar) have completely full outer shells — they are the most chemically stable elements.",
  },
];

export default function BohrModelViewer() {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold text-foreground mb-4">Key Concepts</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {KEY_CONCEPTS.map((c) => (
          <div key={c.title} className="flex gap-3 rounded-xl bg-muted/40 border border-border p-4">
            <span className="text-xl shrink-0">{c.icon}</span>
            <div>
              <p className="text-sm font-semibold text-foreground mb-0.5">{c.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
