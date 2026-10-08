import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const getAccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/assignments/lewis-quiz-access", () => ({ getLewisQuizAccess: getAccess }));
vi.mock("@/components/lewis/LewisDotExplorer", () => ({ default: () => null }));
vi.mock("@/components/lewis/IonicCompoundExplorer", () => ({ default: () => null }));
vi.mock("@/components/lewis/CovalentBondExplorer", () => ({ default: () => null }));

import LewisPracticePage from "@/app/(student)/student/labs/lewis/page";

beforeEach(() => { getAccess.mockReset(); });

describe("Lewis practice quiz cards", () => {
  it("offers only the quiz whose class lesson is currently open", async () => {
    getAccess.mockImplementation(async (kind: string) => ({ status: kind === "covalent" ? "available" : "locked" }));
    const html = renderToStaticMarkup(await LewisPracticePage());
    expect(html).toContain('href="/student/quizzes/covalent"');
    expect(html).not.toContain('href="/student/quizzes/ionic"');
    expect(html).toContain("The matching lesson has not been assigned");
    expect(html).toContain("Covalent Compounds Quiz");
    expect(html).toContain("Ionic Compounds Quiz");
    expect(html).toContain("Untracked practice");
    expect(html).toContain('href="/student"');
  });

  it.each([
    ["scheduled", "scheduled but not open yet"],
    ["closed", "closed; this quiz is unavailable"],
    ["locked", "not been assigned"],
    ["error", "Could not check availability"],
    ["unauthenticated", "Sign in to check"],
  ])("explains %s availability without offering inaccessible quizzes", async (status, message) => {
    getAccess.mockResolvedValue({ status, message: "Could not check availability" });
    const html = renderToStaticMarkup(await LewisPracticePage());
    expect(html).toContain(message);
    expect(html).not.toContain('href="/student/quizzes/');
    expect(html).not.toContain("Start quiz");
  });
});
