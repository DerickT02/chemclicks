// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Help from "@/app/help/page";

afterEach(cleanup);

describe("classroom help page", () => {
  it("provides truthful help/data information, including saved quiz scores, without an invented retention policy", () => {
    render(<Help />);
    expect(screen.getByRole("heading", { name: "What information is stored" })).toBeInTheDocument();
    expect(screen.getByText(/not a school-approved retention policy/)).toBeInTheDocument();
    expect(screen.getByText(/Practice labs are not saved for your teacher/)).toBeInTheDocument();
    expect(screen.getByText(/assigned quiz attempts with their scores and pass results/)).toBeInTheDocument();
    expect(screen.getByText(/Disabling a class does not erase/)).toBeInTheDocument();
  });
});
