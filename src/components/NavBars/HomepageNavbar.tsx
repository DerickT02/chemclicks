"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function HomepageNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleScroll = (id: string) => {
    if (pathname === "/") {
      const section = document.getElementById(id);
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      router.push(`/#${id}`);
    }
  };

  return (
    <nav className="flex items-center justify-between px-6 h-14 bg-background border-b border-foreground/10">

      <Link
        href="/"
        className="flex items-center gap-2 text-foreground font-medium text-sm hover:opacity-80 transition-opacity duration-200"
      >
        ChemClicks
      </Link>

      <div className="flex items-center gap-6">
        <button
          onClick={() => handleScroll("features")}
          className="text-sm text-foreground/50 hover:text-foreground transition-colors duration-200"
        >
          Features
        </button>
        <button
          onClick={() => handleScroll("how-it-works")}
          className="text-sm text-foreground/50 hover:text-foreground transition-colors duration-200"
        >
          How it works
        </button>
      </div>

      <Link
        href="/login"
        className="text-sm font-medium px-4 py-1.5 rounded-full border border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 transition-colors duration-200"
      >
        Sign in
      </Link>

    </nav>
  );
}