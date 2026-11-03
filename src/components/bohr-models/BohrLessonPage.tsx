import BohrModelViewer, { type BohrLessonMode } from "@/components/bohr-models/BohrModelViewer";

type BohrLessonPageProps = {
  mode: Exclude<BohrLessonMode, "combined">;
};

const LESSON_CONTENT = {
  intro: {
    title: "Bohr Model Introduction",
    description:
      "Explore neutral atoms among the first 20 elements, identify the protons in the nucleus, and observe the 2, 8, 8, 2 shell-filling pattern.",
  },
  stability: {
    title: "Bohr Model Stability",
    description:
      "Adjust proton and electron counts independently to explore noble-gas stability, neutral charge, and ionic charge.",
  },
} as const;

export default function BohrLessonPage({ mode }: BohrLessonPageProps) {
  const content = LESSON_CONTENT[mode];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-4xl" aria-hidden="true">⚛️</span>
            <h1 className="text-3xl font-bold text-foreground">{content.title}</h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {content.description}
          </p>
        </header>

        <BohrModelViewer mode={mode} />
      </div>
    </div>
  );
}

