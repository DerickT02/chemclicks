"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { getNavigationIdentity, type NavigationIdentity } from "@/lib/auth/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = {
  public: [
    { label: "Features", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
  ],
  student: [
    { label: "My assignments", href: "/student" },
    { label: "Practice labs", href: "/student/labs" },
  ],
  teacher: [{ label: "Classrooms", href: "/admin" }],
};

function scrollPaddingTopPx(): number {
  const raw = getComputedStyle(document.documentElement).scrollPaddingTop;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Token so a new jump cancels any in-flight eased scroll. */
let scrollAnimationToken = 0;

function scrollToYSmooth(targetY: number) {
  const token = ++scrollAnimationToken;
  const startY = window.scrollY;
  const delta = targetY - startY;
  if (Math.abs(delta) < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, targetY);
    return;
  }

  const durationMs = Math.min(900, Math.max(450, Math.abs(delta) * 0.55));
  const t0 = performance.now();
  function frame(now: number) {
    if (token !== scrollAnimationToken) return;
    const t = Math.min(1, (now - t0) / durationMs);
    window.scrollTo(0, startY + delta * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(frame);
    else window.scrollTo(0, targetY);
  }
  requestAnimationFrame(frame);
}

function scrollToIdSmooth(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  scrollToYSmooth(el.getBoundingClientRect().top + window.scrollY - scrollPaddingTopPx());
}

function isActiveLink(pathname: string, href: string): boolean {
  if (href === "/student") {
    return pathname === href || pathname.startsWith("/student/assignments/") || pathname.startsWith("/student/quizzes/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const menuId = useId();
  const [mobileMenu, setMobileMenu] = useState({ pathname, open: false });
  const mobileOpen = mobileMenu.pathname === pathname && mobileMenu.open;
  if (mobileMenu.pathname !== pathname) setMobileMenu({ pathname, open: false });
  function setMobileOpen(open: boolean) {
    setMobileMenu({ pathname, open });
  }
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [identity, setIdentity] = useState<NavigationIdentity | null>(null);
  const identityRequest = useRef(0);
  const signOutOperation = useRef<symbol | null>(null);

  const role = !isSigningOut && !signOutError && identity?.status === "signed-in" ? identity.role : null;
  const links = LINKS[role ?? "public"];
  const logoHref = role === "student" ? "/student" : role === "teacher" ? "/admin" : "/";
  const navbarCtaClassName =
    "text-sm font-semibold px-4 py-1.5 rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 whitespace-nowrap disabled:opacity-50";

  useEffect(() => {
    let disposed = false;
    async function refreshIdentity() {
      const currentRequest = ++identityRequest.current;
      try {
        const result = await getNavigationIdentity();
        if (!disposed && identityRequest.current === currentRequest) setIdentity(result);
      } catch {
        if (!disposed && identityRequest.current === currentRequest) setIdentity({ status: "error" });
      }
    }

    void refreshIdentity();
    try {
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (disposed || event === "INITIAL_SESSION") return;
        // Invalidate reads immediately, before the deferred refresh starts.
        ++identityRequest.current;
        // A local SIGNED_OUT event is not confirmation that the server session ended.
        if (event === "SIGNED_OUT" && signOutOperation.current) return;
        if (event !== "SIGNED_OUT") {
          // A newer login/session change owns the UI; old sign-out work must not publish or navigate.
          signOutOperation.current = null;
          setIsSigningOut(false);
          setSignOutError(undefined);
        }
        // Do not await Auth-related work inside the Supabase callback.
        queueMicrotask(() => { if (!disposed) void refreshIdentity(); });
      });
      return () => {
        disposed = true;
        signOutOperation.current = null;
        subscription.unsubscribe();
      };
    } catch {
      // The verified server reader can still resolve identity when browser configuration fails.
      return () => {
        disposed = true;
        signOutOperation.current = null;
      };
    }
  }, []);

  async function handleSignOut() {
    if (signOutOperation.current) return;
    const operation = Symbol("sign-out");
    signOutOperation.current = operation;
    const isCurrentOperation = () => signOutOperation.current === operation;
    setIsSigningOut(true);
    setSignOutError(undefined);
    ++identityRequest.current;
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (!isCurrentOperation()) return;
      if (error) throw error;
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isCurrentOperation()) return;
      const serverIdentity = await getNavigationIdentity();
      if (!isCurrentOperation()) return;
      if (sessionError || data.session || serverIdentity.status !== "signed-out") {
        throw new Error("Sign-out could not be confirmed.");
      }
      ++identityRequest.current;
      setIdentity(serverIdentity);
      setMobileOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      if (isCurrentOperation()) {
        setSignOutError("We could not confirm sign out. Please try again before leaving this device.");
      }
    } finally {
      if (isCurrentOperation()) {
        signOutOperation.current = null;
        setIsSigningOut(false);
      }
    }
  }

  function authControl(mobile: boolean) {
    const className = mobile ? `${navbarCtaClassName} block w-full text-center mt-2` : navbarCtaClassName;
    if (!identity && !isSigningOut && !signOutError) return <span className="text-sm text-muted-foreground">Checking session...</span>;
    if (identity?.status === "signed-out" && !isSigningOut && !signOutError) {
      return <Link href="/login" className={className} onClick={() => setMobileOpen(false)}>Sign in</Link>;
    }
    // Keep sign out available even when the session/dashboard check failed.
    return (
      <button type="button" className={className} onClick={() => void handleSignOut()} disabled={isSigningOut}>
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
    );
  }

  function navigationLinks(mobile: boolean) {
    return links.map((link) => {
      const active = isActiveLink(pathname, link.href);
      return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active ? "page" : undefined}
          className={`${mobile ? "block px-3 py-2 rounded-md" : "px-3 py-1.5 rounded-full"} text-sm font-medium transition-colors whitespace-nowrap ${active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          onClick={(event) => {
            if (pathname === "/" && link.href.startsWith("/#")) {
              event.preventDefault();
              scrollToIdSmooth(link.href.slice(2));
            }
            setMobileOpen(false);
          }}
        >
          {link.label}
        </Link>
      );
    });
  }

  const accountMessage = signOutError
    ?? (identity?.status === "error" ? "Account navigation is unavailable. Refresh to try again."
      : identity?.status === "signed-in" ? identity.message : undefined);

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <Link
        href={logoHref}
        className="mr-4 flex items-center gap-2 whitespace-nowrap text-sm font-medium text-foreground transition-opacity hover:opacity-80"
        onClick={(event) => {
          if (pathname === logoHref) { event.preventDefault(); scrollToYSmooth(0); }
          setMobileOpen(false);
        }}
      >
        <Image src="/favicon.svg" alt="" width={20} height={20} loading="eager" />
        ChemClicks
      </Link>

      <div className="hidden flex-1 items-center justify-end gap-1 md:flex">
        {navigationLinks(false)}
        <div className="ml-4">{authControl(false)}</div>
      </div>

      <button
        type="button"
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
        aria-expanded={mobileOpen}
        aria-controls={menuId}
      >
        {mobileOpen ? (
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      <div className="absolute left-0 right-0 top-full">
        <div id={menuId} hidden={!mobileOpen} className="space-y-1 border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          {mobileOpen ? <>{navigationLinks(true)}{authControl(true)}</> : null}
        </div>
        {accountMessage ? (
          <p role="alert" className="border-b border-border bg-card px-4 py-2 text-sm text-destructive">
            {accountMessage}
          </p>
        ) : null}
      </div>
    </nav>
  );
}
