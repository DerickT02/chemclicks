import LoadingIcon from "@/components/ui/LoadingIcon";

type Props = {
  /** What is loading, shown under the animation and announced to assistive tech. */
  label?: string;
};

/** Centered route-level loading state: a small Bohr-style atom with orbiting electrons. */
export default function LoadingScreen({ label = "Loading…" }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen-below-nav flex flex-col items-center justify-center gap-5 bg-background px-6 text-center"
    >
      <LoadingIcon />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
