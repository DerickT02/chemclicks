import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/lewis/LewisDotExplorer", () => ({ default: () => null }));
vi.mock("@/components/lewis/IonicCompoundExplorer", () => ({ default: () => null }));
vi.mock("@/components/lewis/CovalentBondExplorer", () => ({ default: () => null }));

import LewisPracticePage from "@/app/(student)/student/labs/lewis/page";

describe("Lewis practice lab", () => {
  it("has no quizzes; quizzes are reached through assignments", () => {
    const html = renderToStaticMarkup(<LewisPracticePage />);
    expect(html).not.toContain("Untracked practice");
    expect(html).not.toContain("Back to");
    expect(html).not.toContain("/student/quizzes/");
    expect(html).not.toMatch(/quiz/i);
  });
});
