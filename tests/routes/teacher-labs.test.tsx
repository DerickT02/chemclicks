// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TeacherLabsPage from "@/app/admin/labs/page";
import TeacherBohrModelsLabPage from "@/app/admin/labs/bohr-models/page";
import TeacherLewisLabPage from "@/app/admin/labs/lewis/page";
import TeacherMeasurementLabPage from "@/app/admin/labs/measurement/page";
import StudentLabsPage from "@/app/(student)/student/labs/page";

function hrefs(html: string): string[] {
  const container = document.createElement("div");
  container.innerHTML = html;
  return [...container.querySelectorAll("a")].map((link) => link.getAttribute("href")!);
}

describe("teacher labs", () => {
  it("lists every lab and keeps the teacher inside the teacher area", () => {
    const links = hrefs(renderToStaticMarkup(<TeacherLabsPage />));
    expect(links).toEqual(["/admin/labs/bohr-models", "/admin/labs/lewis", "/admin/labs/measurement"]);
    for (const href of links) {
      expect(existsSync(resolve(process.cwd(), "src/app", href.slice(1), "page.tsx")), `Missing route for ${href}`).toBe(true);
    }
  });

  it("leaves the student index linking to the student lab routes", () => {
    const links = hrefs(renderToStaticMarkup(<StudentLabsPage />));
    expect(links).toEqual(["/student/labs/bohr-models", "/student/labs/lewis", "/student/labs/measurement"]);
  });

  it.each([
    ["Bohr Models", TeacherBohrModelsLabPage],
    ["Lewis Structures", TeacherLewisLabPage],
    ["Measurement Lab", TeacherMeasurementLabPage],
  ] as const)("shows the %s lab without quizzes or student-only links", (title, Page) => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain(title);
    expect(html).not.toContain("/student/");
    expect(html).not.toMatch(/quiz/i);
  });
});
