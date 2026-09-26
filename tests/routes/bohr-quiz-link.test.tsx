import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BohrModelsPage from "@/app/(student)/student/labs/bohr-models/page";

function pageFileFor(route: string): string {
  return fileURLToPath(
    new URL(`../../src/app/(student)${route}/page.tsx`, import.meta.url),
  );
}

describe("Bohr models lab quiz link", () => {
  it("points to a quiz page that actually exists", () => {
    const html = renderToStaticMarkup(<BohrModelsPage />);
    const match = html.match(/<a[^>]*href="([^"]+)"[^>]*>\s*Go to quiz/);

    expect(match).not.toBeNull();
    const href = match![1];
    expect(href).toBe("/student/quizzes/bohr");
    expect(existsSync(pageFileFor(href))).toBe(true);
  });
});
