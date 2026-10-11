// @vitest-environment jsdom
process.env.TZ = "America/Los_Angeles";

import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/assignments/actions", () => ({
  saveAssignment: vi.fn(),
}));

import AssignmentForm from "@/app/admin/assignments/AssignmentForm";
import { saveAssignment, type AssignmentFormState } from "@/app/admin/assignments/actions";
import type { ActivityCatalogEntry } from "@/lib/db/activities";

afterEach(cleanup);

const activities: ActivityCatalogEntry[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Lewis Practice",
    type: "lewis_diagram",
    order_index: 1,
    description: "Explore valence electrons with Lewis dot diagrams",
    category: "Lewis Structures",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Lewis Practice",
    type: "lewis_structures_ionic",
    order_index: 2,
    description: "Explore ionic compounds and charge balance",
    category: "Lewis Structures",
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

    expect(screen.getAllByText("Lewis Practice")).toHaveLength(2);
    expect(screen.getAllByText("Lewis Structures")).toHaveLength(2);
    expect(
      screen.getByText("Explore valence electrons with Lewis dot diagrams"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Explore ionic compounds and charge balance"),
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

  it("disables Bohr, enables the tenths ruler and hides the retired ruler choice", async () => {
    const user = userEvent.setup();
    const unavailable: ActivityCatalogEntry[] = [
      { ...activities[0], id: "bohr-intro", title: "Bohr intro", type: "bohr_model_intro" },
      { ...activities[0], id: "bohr-stability", title: "Bohr stability", type: "bohr_model_stability" },
      { ...activities[0], id: "tenths", title: "Tenths ruler", type: "measurement_ruler_tenths" },
      { ...activities[0], id: "hundredths", title: "Retired ruler", type: "measurement_ruler_hundredths" },
    ];
    render(<AssignmentForm classId="class" activities={unavailable} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.queryByText("Retired ruler")).not.toBeInTheDocument();
    expect(screen.getAllByText(/assigned exploration experience is not supported/)).toHaveLength(2);
    for (const radio of radios.slice(0, 2)) {
      expect(radio).toBeDisabled();
      await user.click(radio);
      expect(radio).not.toBeChecked();
    }
    await user.click(radios[2]);
    expect(radios[2]).toBeChecked();
    expect(screen.getByRole("button", { name: "Assign activity" })).toBeEnabled();
  });

  it.each(["unsupported", "assigned", "removed"])("invalidates a selected activity when it becomes %s", async (change) => {
    const user = userEvent.setup();
    const view = render(<AssignmentForm classId="class" activities={activities} />);
    await user.click(screen.getAllByRole("radio")[0]);
    expect(screen.getByRole("button", { name: "Assign activity" })).toBeEnabled();
    const next = change === "removed" ? activities.slice(1)
      : change === "unsupported" ? [{ ...activities[0], type: "bohr_model_intro" as const }, activities[1]] : activities;
    view.rerender(<AssignmentForm classId="class" activities={next}
      assignedActivityIds={change === "assigned" ? [activities[0].id] : []} />);
    expect(screen.getByRole("button", { name: "Assign activity" })).toBeDisabled();
    expect(screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
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

describe("new assignment save feedback", () => {
  it("clears selection/dates after success and identifies the activity and class", async () => {
    vi.mocked(saveAssignment).mockResolvedValueOnce({ status: "success", message: "Activity assigned." });
    const user = userEvent.setup();
    render(<AssignmentForm classId="class" className="Chemistry A" activities={activities} />);
    await user.click(screen.getAllByRole("radio")[0]);
    fireEvent.change(screen.getByLabelText("Opens at — optional"), { target: { value: "2026-09-12T12:00" } });
    await user.click(screen.getByRole("button", { name: "Assign activity" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Lewis Practice — Chemistry A: Activity assigned.");
    });
    expect(screen.getByLabelText("Opens at — optional")).toHaveValue("");
    expect(screen.getByLabelText("Closes at — optional")).toHaveValue("");
    expect(screen.getAllByRole("radio").every(input => !(input as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("button", { name: "Assign activity" })).toBeDisabled();
  });
  it.each(["returned", "thrown"])("preserves inputs and restores controls after a %s failure", async kind => {
    if (kind === "returned") vi.mocked(saveAssignment).mockResolvedValueOnce({ status: "error", message: "Could not save." });
    else vi.mocked(saveAssignment).mockRejectedValueOnce(new Error("private connection details"));
    const user = userEvent.setup();
    render(<AssignmentForm classId="class" activities={activities} />);
    await user.click(screen.getAllByRole("radio")[0]);
    fireEvent.change(screen.getByLabelText("Opens at — optional"), { target: { value: "2026-09-12T12:00" } });
    await user.click(screen.getByRole("button", { name: "Assign activity" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private");
    expect(screen.getByLabelText("Opens at — optional")).toHaveValue("2026-09-12T12:00");
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
    expect(screen.getByRole("button", { name: "Assign activity" })).toBeEnabled();
  });
  it("reasserts selection after repeated identical errors and native form resets", async () => {
    vi.mocked(saveAssignment).mockResolvedValue({ status: "error", message: "Try again." });
    const user = userEvent.setup();
    render(<AssignmentForm classId="class" activities={activities} />);
    await user.click(screen.getAllByRole("radio")[0]);
    for (let attempt = 0; attempt < 2; attempt++) {
      await user.click(screen.getByRole("button", { name: "Assign activity" }));
      await screen.findByRole("alert");
      expect(screen.getAllByRole("radio")[0]).toBeChecked();
      expect(screen.getByRole("button", { name: "Assign activity" })).toBeEnabled();
    }
  });
  it("freezes selection and dates while pending", async () => {
    let resolve!: (result: AssignmentFormState) => void;
    vi.mocked(saveAssignment).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const user = userEvent.setup();
    render(<AssignmentForm classId="class" activities={activities} />);
    await user.click(screen.getAllByRole("radio")[0]);
    await user.click(screen.getByRole("button", { name: "Assign activity" }));
    expect(screen.getAllByRole("radio").every(input => (input as HTMLInputElement).disabled || Boolean(input.closest("fieldset:disabled")))).toBe(true);
    expect(screen.getByLabelText("Opens at — optional")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await act(async () => { resolve({ status: "error", message: "Try again." }); });
    expect(screen.getByRole("button", { name: "Assign activity" })).toBeEnabled();
  });
});
