
const features = [
    { title: "Bohr Models", description: "Explore atomic models for elements 1–20. Visualize the nucleus and electron-shell arrangements.", icon: "⚛️" },
    { title: "Stability & Lewis", description: "Compare electron arrangements and ions, then explore Lewis diagrams, covalent molecules, and ionic compounds.", icon: "🧪" },
    { title: "Measurement Lab", description: "Practice reading a ruler and measuring volume at the bottom of a graduated cylinder's meniscus.", icon: "📏" },
];

const steps = [
    { number: "1", title: "Teachers", description: "Create a teacher account and verify your email. Set up classes and share classroom codes with students." },
    { number: "2", title: "Students", description: "Join your teacher's class, then sign in with your Student ID and classroom code. No password needed." },
    { number: "3", title: "Learn", description: "Open My assignments for class work, or use the separate untracked practice labs to explore." },
];

export default function Lesson_Overview() {
    return (
    <div className="flex flex-col gap-24 bg-background py-20">

        <section>
            <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-foreground text-center text-xl font-medium mb-12">What you will learn</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {features.map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-card p-8">
                    <div className="text-2xl mb-4">{f.icon}</div>
                    <h3 className="text-foreground font-semibold mb-2">{f.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                </div>
                ))}
            </div>
            </div>
        </section>

        <section
            id="how-it-works"
            className="max-w-6xl mx-auto w-full border-t border-border px-4 pt-20"
        >
            <h2 className="text-foreground text-center text-xl font-medium mb-12">How it works</h2>
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-12 md:p-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {steps.map((s) => (
                        <div key={s.number} className="flex flex-col items-center text-center">
                            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-accent/50 bg-muted">
                                <span className="font-bold text-accent">{s.number}</span>
                            </div>
                            <h3 className="text-foreground font-semibold mb-2">{s.title}</h3>
                            <p className="text-muted-foreground text-sm max-w-xs">{s.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

    </div>
    );
}