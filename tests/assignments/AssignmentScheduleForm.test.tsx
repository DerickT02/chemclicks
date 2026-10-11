// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/assignments/actions", () => ({
  saveAssignment: vi.fn(),
}));

import AssignmentScheduleForm from "@/app/admin/assignments/AssignmentScheduleForm";

afterEach(cleanup);

describe("AssignmentScheduleForm", () => {
  it("prefills UTC schedule fields and submits the assignment id", () => {
    render(
      <AssignmentScheduleForm
        classId="33333333-3333-4333-8333-333333333333"
        assignmentId="44444444-4444-4444-8444-444444444444"
        activityId="11111111-1111-4111-8111-111111111111"
        initialOpensAt="2026-09-12T08:00:00.000Z"
        initialClosesAt={null}
      />,
    );

    expect(screen.getByText("Adjust schedule (UTC)")).toBeInTheDocument();
    expect(screen.getByLabelText("Opens at — optional")).toHaveValue(
      "2026-09-12T08:00",
    );
    expect(
      screen.getByRole("button", { name: "Clear opening time" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Closes at — optional")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Save schedule" }),
    ).toBeEnabled();

    const form = screen.getByRole("button", { name: "Save schedule" }).closest("form");
    expect(form?.querySelector('input[name="assignment_id"]')).toHaveValue(
      "44444444-4444-4444-8444-444444444444",
    );
  });
});
