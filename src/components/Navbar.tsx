"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  if (pathname.startsWith("/teacher") || pathname.startsWith("/admin")) return "teacher";
  if (pathname.startsWith("/student")) return "student";
  return "public";
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const role = navRoleFromPathname(pathname);
  const links = LINKS[role];
  const showPublicAuthCta = role === "public" && !isAuthenticated;

  const logoHref =
    role === "public" ? "/" : role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
  const navbarCtaClassName =
    "text-sm font-semibold px-4 py-1.5 rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 whitespace-nowrap";

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

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out failed:", error.message);
        return;
      }

      router.push("/login");
      router.refresh();
      setMobileOpen(false);
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setIsSigningOut(false);
    }
  }

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
        {showPublicAuthCta ? (
          <Link
            href="/login"
            className={navbarCtaClassName}
          >
            Sign in
          </Link>
        ) : (
          <button
            type="button"
            className={navbarCtaClassName}
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
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
          {showPublicAuthCta && (
            <Link
              href="/login"
              className="block text-sm font-semibold text-center bg-accent text-accent-foreground px-4 py-2 rounded-lg mt-2 transition-opacity hover:opacity-90"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
          )}
          {(role === "teacher" || role === "student") && (
            <button
              type="button"
              className="block w-full text-center text-sm font-semibold bg-accent text-accent-foreground px-4 py-2 rounded-lg mt-2 transition-opacity hover:opacity-90"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          )}
        </div>
      )}

    </nav>
  );
}