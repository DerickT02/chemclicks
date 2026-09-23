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
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Ruler Practice",
    type: "measurement_ruler_hundredths",
    order_index: 2,
    description: "Practice ruler measurements to the nearest hundredth",
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

    const select = screen.getByRole("combobox", { name: "Activity" });
    expect(
      screen.getByRole("option", {
        name: "Ruler Practice — Practice ruler measurements to the nearest tenth",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: "Ruler Practice — Practice ruler measurements to the nearest hundredth",
      }),
    ).toBeInTheDocument();

    await user.selectOptions(select, activities[1].id);

    expect(select).toHaveValue(activities[1].id);
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
