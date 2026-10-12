import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LoadingScreen from "@/components/ui/LoadingScreen";

describe("LoadingScreen", () => {
  it("announces its label as a polite status and hides the decorative atom", () => {
    const html = renderToStaticMarkup(<LoadingScreen label="Loading your assignments…" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Loading your assignments…");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("centers itself in the space below the navbar", () => {
    const html = renderToStaticMarkup(<LoadingScreen />);
    for (const name of ["min-h-screen-below-nav", "items-center", "justify-center"]) expect(html).toContain(name);
    expect(html).toContain("Loading…");
  });

  it("stops the orbit animation when the viewer prefers reduced motion", () => {
    const html = renderToStaticMarkup(<LoadingScreen />);
    const orbits = html.match(/<g class="[^"]*animate-spin[^"]*"/g) ?? [];
    expect(orbits).toHaveLength(2);
    for (const orbit of orbits) expect(orbit).toContain("motion-reduce:animate-none");
  });
});
