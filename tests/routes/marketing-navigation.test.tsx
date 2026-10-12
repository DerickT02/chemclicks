/** @vitest-environment jsdom */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import Home from "@/app/page";
import Footer from "@/components/Footer";
import LabsPage from "@/app/(student)/student/labs/page";

function routeExists(href: string): boolean {
  return ["", "/(student)", "/(teacher)"].some((group) => existsSync(
    resolve(process.cwd(), `src/app${group}`, href.slice(1), "page.tsx"),
  ));
}

function verifyLinks(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const links = container.querySelectorAll("a");
  expect(links.length).toBeGreaterThan(0);
  links.forEach((link) => {
    const href = link.getAttribute("href")!;
    expect(href).not.toBe("#");
    if (href.startsWith("/#")) {
      expect(container.querySelector(`[id="${href.slice(2)}"]`)).not.toBeNull();
    } else {
      expect(routeExists(href), `Missing route for ${href}`).toBe(true);
    }
  });
}

describe("honest public navigation and marketing", () => {
  it("routes Get Started to role selection and uses working footer destinations/anchors", () => {
    const html = renderToStaticMarkup(<Home />);
    verifyLinks(html);
    expect(html).toMatch(/href="\/login"[^>]*>Get Started/);
    expect(html).toContain("Student ID and classroom code");
    expect(html).not.toContain("username");
    expect(html).not.toContain("Draw Lewis diagrams");
    expect(html).not.toContain("Build atomic models");
    expect(html).not.toContain("hover:border-accent/40");
    expect(html).not.toContain("tenths and hundredths");
    expect(html).toContain("Practice reading a ruler");
  });

  it("does not render fake resource/legal links or collect newsletter emails", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain("ChemClicks");
    expect(html).not.toContain("CHEMISTRY CURRICULUM");
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain("<input");
    for (const placeholder of ["Stay Up to Date", "Schools", "Help center", "Docs", "Guides", "Privacy", "Terms"]) {
      expect(html).not.toContain(placeholder);
    }
  });
});

describe("practice navigation", () => {
  it("does not advertise a separate hundredths offering in the practice index", () => {
    const html = renderToStaticMarkup(<LabsPage />);
    expect(html).not.toContain("hundredths");
    expect(html).toContain("Explore ruler scales");
  });

  it("links the practice index to lab pages that exist", () => {
    verifyLinks(renderToStaticMarkup(<LabsPage />));
  });
});
