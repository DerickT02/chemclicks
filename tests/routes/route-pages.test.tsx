import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import NotFound from "../../src/app/not-found";
import AppError from "../../src/app/error";
import LoginRolePage from "../../src/app/login/page";
import MeasurementLabPage from "../../src/app/(student)/student/labs/measurement/page";

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

  it("renders the measurement lab with the graduated cylinder", () => {
    const html = renderToStaticMarkup(<MeasurementLabPage />);

    expect(html).toContain("Measurement Lab");
    expect(html).toContain("Graduated Cylinder (Meniscus)");
    expect(html).toContain("32.0 mL");
    expect(html).not.toContain("Go to quiz");
  });
});
