"use client";

import { useState } from "react";
import Link from "next/link";

// links
const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Labs", href: "/labs" },
  { label: "Models", href: "/models" },
];

// navbar component 
export default function Navbar() {
  const [activeLink, setActiveLink] = useState("Home");

  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between px-6 h-14 shrink-0 bg-background border-b border-foreground/10">

      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-foreground/70" />
        <span className="text-foreground font-medium text-sm">Chemistry Curriculum</span>
      </div>

      {/* Nav Links*/}
      <div className="flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            onClick={() => setActiveLink(link.label)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200
              ${activeLink === link.label
                ? "bg-foreground text-background"
                : "text-foreground/60 hover:text-foreground"
              }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Right Side Icons */}
      <div className="flex items-center gap-3">

        {/* Bell Icon */}
        <button
          aria-label="Notifications"
          className="p-2 rounded-full text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* Profile Button */}
        <button
          aria-label="Profile"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors duration-200"
        >
          {/* Avatar circle */}
          <div className="w-5 h-5 rounded-full bg-foreground/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="text-sm font-medium">Student</span>
          {/* Chevron down */}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

      </div>
    </nav>
  );
}
