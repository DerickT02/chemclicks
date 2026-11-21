import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CreateAccountRolePage from "@/app/create-account/page";

describe("create-account role selection", () => {
  it("offers teacher and student signup instead of forcing teacher signup", () => {
    const html = renderToStaticMarkup(<CreateAccountRolePage />);
    expect(html).toContain("Create an account as");
    expect(html).toContain('href="/create-account/teacher"');
    expect(html).toContain('href="/create-account/student"');
    expect(html).toContain('href="/login/teacher"');
    expect(html).toContain('href="/login/student"');
    expect(html).not.toContain("REDIRECT");
  });
});
