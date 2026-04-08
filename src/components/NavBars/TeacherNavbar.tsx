"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Dashboard", href: "/teacher/dashboard" },
  { label: "My Classes", href: "/teacher/classes" },
  { label: "Students", href: "/teacher/students" },
  { label: "Labs", href: "/teacher/labs" },
];

export default function TeacherNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-6 h-14 bg-background border-b border-foreground/10">

      {/* ── Logo ── */}
      <Link
        href="/teacher/dashboard"
        className="text-sm font-medium text-foreground hover:opacity-80 transition-opacity duration-200"
      >
        ChemClicks
      </Link>

      {/* ── Desktop Nav Links ── */}
      <div className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200
              ${pathname === link.href
                ? "bg-foreground text-background"
                : "text-foreground/50 hover:text-foreground"
              }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* ── Right Side ── */}
      <div className="hidden md:flex items-center gap-3">

        {/* Bell Icon */}
        <button
          aria-label="Notifications"
          className="p-2 rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* Profile */}
        <button
          aria-label="Profile"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors duration-200"
        >
          <div className="w-5 h-5 rounded-full bg-foreground/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="text-sm font-medium">Teacher</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

      </div>

      {/* ── Mobile Hamburger ── */}
      <button
        className="md:hidden p-2 rounded-md text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors duration-200"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className="absolute top-14 left-0 right-0 md:hidden border-t border-foreground/10 bg-background px-4 pt-2 pb-4 space-y-1 z-50">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="block text-sm font-medium text-foreground/50 hover:text-foreground hover:bg-foreground/10 px-3 py-2 rounded-md transition-colors duration-200"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

    </nav>
  );
}