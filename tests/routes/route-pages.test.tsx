import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import NotFound from "../../src/app/not-found";
import AppError from "../../src/app/error";
import LoginRolePage from "../../src/app/login/page";
import MeasurementLabPage from "../../src/app/(student)/student/labs/measurement/page";

import LewisLabPage from "@/app/(student)/student/labs/lewis/page";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
}));

describe("route page behavior", () => {
  it("renders the not-found page for unmatched routes", () => {
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).toContain("404");
    expect(html).toContain("Page not found");
    expect(html).not.toContain("Something went wrong");
  });

  it("renders the generic error page for application errors", () => {
    const html = renderToStaticMarkup(<AppError />);

    expect(html).toContain("Something went wrong");
    expect(html).toContain("An unexpected error occurred. Please try again.");
    expect(html).not.toContain("Page not found");
  });

  it("keeps valid routes on their own page content", () => {
    const html = renderToStaticMarkup(<LoginRolePage />);

    expect(html).toContain("Sign in as");
    expect(html).not.toContain("Page not found");
    expect(html).not.toContain("Something went wrong");
  });

  it("renders lab pages instead of redirecting to the assignment list", () => {
    expect(() => MeasurementLabPage()).not.toThrow();
    expect(() => LewisLabPage()).not.toThrow();
  });

  it("renders every Lewis explorer on the practice lab without quiz links", () => {
    const html = renderToStaticMarkup(<LewisLabPage />);

    expect(html).toContain("Lewis Diagrams");
    expect(html).toContain("Ionic Bonds");
    expect(html).toContain("Covalent Bonds");
    expect(html).toContain("Example Salts");
    expect(html).toContain("Example Molecules");
    expect(html).not.toContain("/student/quizzes/");
    expect(html).not.toContain("Untracked practice");
  });

  it("offers no practice questions in the measurement lab", () => {
    const html = renderToStaticMarkup(<MeasurementLabPage />);

    expect(html).not.toContain("/student/labs/measurement/questions");
    expect(html).not.toMatch(/quiz|questions/i);
  });

  it("offers only the tenths ruler in the measurement lab", () => {
    const html = renderToStaticMarkup(<MeasurementLabPage />);

    expect(html).toContain("Ruler — Tenths");
    expect(html).toContain("nearest tenth of a centimeter");
    expect(html).toContain('aria-valuetext="5.0 centimeters"');
    expect(html.toLowerCase()).not.toContain("hundredth");
  });
});
