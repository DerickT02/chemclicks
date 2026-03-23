
const features = [
    { title: "Bohr Models", description: "Build atomic models for elements 1-20. Visualize the nucleus, electrons in shells (2, 8, 8, 2).", icon: "⚛️" },
    { title: "Stability & Lewis", description: "Explore stable versus non-stable charged stability. Draw Lewis diagrams and covalent structures.", icon: "🧪" },
    { title: "Measurement Lab", description: "Practice reading scales to tenths and hundredths. Measure with a graduated cylinder at the meniscus.", icon: "📏" },
];

const steps = [
    { number: "1", title: "Teachers", description: "Sign up with your credentials. Set up classes and share classroom codes with students." },
    { number: "2", title: "Students", description: "Enter your teacher's classroom code, then your username. No password needed." },
    { number: "3", title: "Learn", description: "Work through interactive modules—Bohr models, Lewis structures, and measurement." },
];

export default function Lesson_Overview() {
    return (
    <div className="flex flex-col gap-24 py-20 bg-[#0d1117]">

        <section>
            <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-white text-center text-xl font-medium mb-12">What you will learn</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {features.map((f, i) => (
                <div key={i} className="bg-gray-800 border border-[#30363d] p-8 rounded-xl hover:border-emerald-500/30 transition-colors">
                    <div className="text-2xl mb-4">{f.icon}</div>
                    <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
                </div>
                ))}
            </div>
            </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 w-full">
            <div className="bg-[#11161d] border border-[#30363d] rounded-2xl p-12 md:p-16">
                <h2 className="text-white text-center text-xl font-medium mb-16">How it works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {steps.map((s, i) => (
                    <div key={i} className="flex flex-col items-center text-center">
                        <div className="w-10 h-10 rounded-full border border-emerald-500/50 flex items-center justify-center mb-6 bg-[#0d1117]">
                        <span className="text-emerald-400 font-bold">{s.number}</span>
                        </div>
                        <h3 className="text-white font-semibold mb-2">{s.title}</h3>
                        <p className="text-gray-400 text-sm max-w-xs">{s.description}</p>
                    </div>
                    ))}
                </div>
            </div>
        </section>

    </div>
    );
}