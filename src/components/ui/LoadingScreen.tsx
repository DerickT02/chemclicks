type Props = {
  /** What is loading, shown under the animation and announced to assistive tech. */
  label?: string;
};

const ORBIT =
  "origin-center animate-spin [transform-box:view-box] motion-reduce:animate-none";

/** Centered route-level loading state: a small Bohr-style atom with orbiting electrons. */
export default function LoadingScreen({ label = "Loading…" }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen-below-nav flex flex-col items-center justify-center gap-5 bg-background px-6 text-center"
    >
      {/* Decorative; the label below carries the meaning. */}
      <svg viewBox="0 0 96 96" aria-hidden="true" className="size-24">
        <circle cx="48" cy="48" r="20" fill="none" strokeWidth="1.5" strokeDasharray="4 4" className="stroke-electron/40" />
        <circle cx="48" cy="48" r="38" fill="none" strokeWidth="1.5" strokeDasharray="4 4" className="stroke-electron/40" />
        <circle cx="48" cy="48" r="8" className="fill-accent" />
        <g className={`${ORBIT} [animation-duration:1.6s]`}>
          <circle cx="68" cy="48" r="4" className="fill-electron" />
        </g>
        <g className={`${ORBIT} [animation-direction:reverse] [animation-duration:3.2s]`}>
          <circle cx="86" cy="48" r="4" className="fill-electron" />
          <circle cx="10" cy="48" r="4" className="fill-electron" />
        </g>
      </svg>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
