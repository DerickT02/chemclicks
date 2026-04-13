import Link from "next/link";

export default function Get_Started_Button() {
  return (
    <Link
      href="/login/teacher"
      className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Get Started
    </Link>
  );
}
