import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import NotFound from "../../src/app/not-found";
import AppError from "../../src/app/error";
import LoginRolePage from "../../src/app/login/page";
import MeasurementLabPage from "../../src/app/(student)/student/labs/measurement/page";
import MeasurementQuestionsPage from "../../src/app/(student)/student/labs/measurement/questions/page";

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

  it("redirects legacy lab URLs through the assignment list", () => {
    expect(() => MeasurementLabPage()).toThrow("REDIRECT:/student");
    expect(() => LewisLabPage()).toThrow("REDIRECT:/student");
  });

  it("links the measurement lab to its practice questions", () => {
    const html = renderToStaticMarkup(<MeasurementLabPage />);

    expect(html).toContain('href="/student/labs/measurement/questions"');
    expect(html).toContain("Practice measurement questions");
  });

  it("renders the measurement questions page with the instrument chooser", () => {
    const html = renderToStaticMarkup(<MeasurementQuestionsPage />);

    expect(html).toContain("Measurement Questions");
    expect(html).toContain("Start ruler questions");
    expect(html).toContain("Start graduated cylinder questions");
    expect(html).toContain('href="/student/labs/measurement"');
    expect(html).not.toContain("Page not found");
  });
});
