"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = {
  public: [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
  ],
  student: [
    { label: "Home", href: "#" },
    { label: "Labs", href: "#" },
    { label: "Models", href: "#" },
  ],
  teacher: [
    { label: "Classroom", href: "#" },
    { label: "Bohr Models", href: "#" },
    { label: "Stability", href: "#" },
    { label: "Lewis Diagram", href: "#" },
    { label: "Lewis (Covalent)", href: "#" },
    { label: "Lewis (Ionic)", href: "#" },
    { label: "Measurement", href: "#" },
  ],
};

type Role = "public" | "student" | "teacher";

function scrollPaddingTopPx(): number {
  const raw = getComputedStyle(document.documentElement).scrollPaddingTop;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Token so a new jump cancels any in-flight eased scroll */
let scrollAnimationToken = 0;

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Eased vertical scroll (rAF) — avoids native smooth scroll being cancelled mid-flight. */
function scrollToYSmooth(targetY: number) {
  const token = ++scrollAnimationToken;
  const startY = window.scrollY;
  const delta = targetY - startY;

  if (Math.abs(delta) < 2) return;

  if (prefersReducedMotion()) {
    window.scrollTo(0, targetY);
    return;
  }

  const durationMs = Math.min(900, Math.max(450, Math.abs(delta) * 0.55));
  const t0 = performance.now();

  function frame(now: number) {
    if (token !== scrollAnimationToken) return;
    const elapsed = now - t0;
    const t = Math.min(1, elapsed / durationMs);
    window.scrollTo(0, startY + delta * easeOutCubic(t));
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      window.scrollTo(0, targetY);
    }
  }

  requestAnimationFrame(frame);
}

function scrollToTopSmooth() {
  scrollToYSmooth(0);
}

function scrollToIdSmooth(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const pad = scrollPaddingTopPx();
  const targetY = el.getBoundingClientRect().top + window.scrollY - pad;
  scrollToYSmooth(targetY);
}

function navRoleFromPathname(pathname: string): Role {
  if (pathname.startsWith("/teacher")) return "teacher";
  if (pathname.startsWith("/student")) return "student";
  return "public";
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = navRoleFromPathname(pathname);
  const links = LINKS[role];

  const logoHref =
    role === "public" ? "/" : role === "teacher" ? "/teacher/classroom" : "/student/dashboard";

  const handleScroll = (href: string) => {
    const id = href.replace(/^#/, "");
    if (id === "") {
      scrollToTopSmooth();
      return;
    }
    if (pathname === "/") {
      scrollToIdSmooth(id);
    } else {
      router.push(`/#${id}`);
    }
  };

  return (
    <nav className="sticky top-0 z-50 relative flex h-14 items-center justify-between border-b border-foreground/10 bg-background px-6">

      <Link
        href={logoHref}
        className="mr-4 flex items-center gap-2 whitespace-nowrap text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-80"
        onClick={(e) => {
          if (pathname === logoHref) {
            e.preventDefault();
            scrollToTopSmooth();
          }
        }}
      >
        <Image src="/favicon.svg" alt="ChemClicks logo" width={20} height={20} priority />
        ChemClicks
      </Link>

      <div className="hidden md:flex items-center gap-1 flex-1 justify-end">
        {links.map((link) =>
          link.href.startsWith("#") ? (
            <button
              key={link.label}
              type="button"
              onClick={() => handleScroll(link.href)}
              className="px-3 py-1.5 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors duration-200 whitespace-nowrap"
            >
              {link.label}
            </button>
          ) : (
            <Link
              key={link.label}
              href={link.href}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 whitespace-nowrap
                ${pathname === link.href
                  ? "bg-foreground text-background"
                  : "text-foreground/50 hover:text-foreground"
                }`}
            >
              {link.label}
            </Link>
          )
        )}
      </div>

      <div className="hidden md:flex items-center gap-3 ml-4">
        {role === "public" ? (
          <Link
            href="/login"
            className="text-sm font-medium px-4 py-1.5 rounded-full border border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 transition-colors duration-200 whitespace-nowrap"
          >
            Sign in
          </Link>
        ) : role === "teacher" ? (
          <button className="text-sm font-medium px-4 py-1.5 rounded-full border border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 transition-colors duration-200 whitespace-nowrap">
            Sign out
          </button>
        ) : (
          <>
            <button
              aria-label="Notifications"
              className="p-2 rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
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
              <span className="text-sm font-medium capitalize">{role}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </>
        )}
      </div>

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

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 md:hidden border-t border-foreground/10 bg-background px-4 pt-2 pb-4 space-y-1 z-50">
          {links.map((link) =>
            link.href.startsWith("#") ? (
              <button
                key={link.label}
                type="button"
                onClick={() => {
                  handleScroll(link.href);
                  // Let the window scroll start before unmounting the menu (otherwise some browsers stop the animation).
                  window.setTimeout(() => setMobileOpen(false), 320);
                }}
                className="block w-full text-left text-sm font-medium text-foreground/50 hover:text-foreground hover:bg-foreground/10 px-3 py-2 rounded-md transition-colors duration-200"
              >
                {link.label}
              </button>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className={`block text-sm font-medium px-3 py-2 rounded-md transition-colors duration-200
                  ${pathname === link.href
                    ? "bg-foreground text-background"
                    : "text-foreground/50 hover:text-foreground hover:bg-foreground/10"
                  }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          {role === "public" && (
            <Link
              href="/login"
              className="block text-sm font-medium text-center bg-foreground text-background px-4 py-2 rounded-lg mt-2"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
          )}
          {role === "teacher" && (
            <button className="block w-full text-left text-sm font-medium text-foreground/50 hover:text-foreground px-3 py-2 rounded-md transition-colors duration-200">
              Sign out
            </button>
          )}
        </div>
      )}

    </nav>
  );
}