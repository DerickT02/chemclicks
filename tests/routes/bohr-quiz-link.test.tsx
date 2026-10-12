import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BohrModelsPage from "@/app/(student)/student/labs/bohr-models/page";

describe("Bohr models lab", () => {
  it("does not offer a quiz; quizzes are reached through assignments", () => {
    const html = renderToStaticMarkup(<BohrModelsPage />);

    expect(html).not.toContain("/student/quizzes/");
    expect(html).not.toMatch(/quiz/i);
  });
});
