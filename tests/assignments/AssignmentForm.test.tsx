// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/assignments/actions", () => ({
  saveAssignment: vi.fn(),
}));

import AssignmentForm from "@/app/admin/assignments/AssignmentForm";
import type { ActivityCatalogEntry } from "@/lib/db/activities";

afterEach(cleanup);

const activities: ActivityCatalogEntry[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Ruler Practice",
    type: "measurement_ruler_tenths",
    order_index: 1,
    description: "Practice ruler measurements to the nearest tenth",
    category: "Measurement",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Ruler Practice",
    type: "measurement_ruler_hundredths",
    order_index: 2,
    description: "Practice ruler measurements to the nearest hundredth",
    category: "Measurement",
  },
];

describe("assignment activity selection", () => {
  it("distinguishes activities and preserves the selected catalog ID", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentForm
        classId="33333333-3333-4333-8333-333333333333"
        activities={activities}
      />,
    );

    expect(screen.getAllByText("Ruler Practice")).toHaveLength(2);
    expect(screen.getAllByText("Measurement")).toHaveLength(2);
    expect(
      screen.getByText("Practice ruler measurements to the nearest tenth"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Practice ruler measurements to the nearest hundredth"),
    ).toBeInTheDocument();
    expect(screen.getByText("Opens at — optional")).toBeInTheDocument();
    expect(screen.getByText("Closes at — optional")).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    const submit = screen.getByRole("button", { name: "Assign activity" });
    expect(submit).toBeDisabled();

    await user.click(radios[1]);

    expect(radios[1]).toBeChecked();
    expect(radios[1]).toHaveAttribute("value", activities[1].id);
    expect(submit).toBeEnabled();
  });

  it("marks assigned activities and prevents selecting them again", () => {
    render(
      <AssignmentForm
        classId="33333333-3333-4333-8333-333333333333"
        activities={activities}
        assignedActivityIds={[activities[0].id]}
      />,
    );

    expect(screen.getByText("Assigned")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")[0]).toBeDisabled();
    expect(screen.getAllByRole("radio")[1]).toBeEnabled();
  });

  it("shows an explicit empty state and disables assignment", () => {
    render(
      <AssignmentForm
        classId="33333333-3333-4333-8333-333333333333"
        activities={[]}
      />,
    );

    expect(
      screen.getByText("No activities are available to assign."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Assign activity" }),
    ).toBeDisabled();
  });
});
