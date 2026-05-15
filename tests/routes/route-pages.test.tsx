import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import NotFound from "../../src/app/not-found";
import AppError from "../../src/app/error";
import LoginRolePage from "../../src/app/login/page";

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
});
