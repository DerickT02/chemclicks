import Image from "next/image";
import Link from "next/link";

const LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Student sign in", href: "/login/student" },
  { label: "Teacher sign in", href: "/login/teacher" },
  { label: "Help & student data", href: "/help" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background text-muted-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Image src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">ChemClicks</p>
              <p className="mt-1 text-xs">Explore chemistry with interactive tools.</p>
            </div>
          </div>
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
              {LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="underline-offset-4 hover:text-foreground hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-8 border-t border-border pt-6 text-xs">&copy; 2026 ChemClicks</p>
      </div>
    </footer>
  );
}
