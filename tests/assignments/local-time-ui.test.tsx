// @vitest-environment jsdom
process.env.TZ = "America/Los_Angeles";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/admin/assignments/actions", () => ({ saveAssignment: mocks.save }));
import AssignmentForm from "@/app/admin/assignments/AssignmentForm";
import AssignmentSchedule from "@/app/admin/assignments/AssignmentSchedule";
import LocalizedTimestamp from "@/components/datetime/LocalizedTimestamp";

const props = {
  classId: "11111111-1111-4111-8111-111111111111", className: "Chemistry A",
  activities: [{ id: "22222222-2222-4222-8222-222222222222", title: "Lewis dots", type: "lewis_diagram" as const, category: "Lewis", description: "Explore valence electrons", order_index: 1 }],
};
const schedule = {
  classId: props.classId, className: props.className, activityTitle: "Lewis dots", renderedAt: Date.parse("2026-09-12T12:00Z"),
  assignment: { id: "33333333-3333-4333-8333-333333333333", activity_id: props.activities[0].id, opens_at: "2026-10-16T06:59:00Z", closes_at: "2026-10-17T06:59:00Z" },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockResolvedValue({ status: "success", message: "Activity assigned." });
});
afterEach(cleanup);

describe("local scheduling and viewer dates", () => {
  it("renders UTC on the server, then the viewer's local time after hydration", async () => {
    // Pin the language so the expected text does not depend on this machine's locale.
    const format = Date.prototype.toLocaleString;
    const localize = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (this: Date, _locales, options) {
      return format.call(this, "en-US", options);
    });
    const element = <LocalizedTimestamp value="2026-10-16T06:59:00Z" />;
    const html = renderToString(element);
    expect(html).toContain("2026-10-16 06:59:00 UTC");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const recover = vi.fn();
    let root!: ReturnType<typeof hydrateRoot>;
    try {
      await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: recover }); });
      expect(recover).not.toHaveBeenCalled();
      expect(container).toHaveTextContent("Oct 15, 2026, 11:59 PM PDT");
      expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-10-16T06:59:00Z");
      expect(container.querySelector("time")).toHaveAttribute("title", "2026-10-16 06:59:00 UTC");
    } finally {
      await act(async () => { root?.unmount(); });
      container.remove();
      localize.mockRestore();
    }
  });
  it("does not emit time elements for unparseable values", () => {
    render(<LocalizedTimestamp value="bad" />);
    expect(screen.getByText("Date unavailable")).toBeInTheDocument();
    expect(document.querySelector("time")).toBeNull();
  });
  it("uses a minute-precision picker and submits entered local time as the UTC instant", async () => {
    const user = userEvent.setup();
    render(<AssignmentForm {...props} />);
    const close = screen.getByLabelText("Closes at — optional");
    expect(close).toHaveAttribute("type", "datetime-local");
    expect(close).not.toHaveAttribute("step");
    await user.click(screen.getByRole("radio"));
    fireEvent.change(close, { target: { value: "2026-10-15T23:59" } });
    await user.click(screen.getByRole("button", { name: "Assign activity" }));
    const data = mocks.save.mock.calls[0][1] as FormData;
    expect(data.get("closes_at")).toBe("2026-10-16T06:59:00.000");
    expect(data.get("opens_at")).toBe("");
  });
  it("prefills the editor in local time and resubmits an untouched field's stored instant", async () => {
    mocks.save.mockResolvedValue({ status: "error", message: "Could not save." });
    const user = userEvent.setup();
    render(<AssignmentSchedule {...schedule} />);
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    expect(screen.getByLabelText("Opens at — optional")).toHaveValue("2026-10-15T23:59");
    fireEvent.change(screen.getByLabelText("Closes at — optional"), { target: { value: "2026-10-18T08:00" } });
    await user.click(screen.getByRole("button", { name: "Save dates" }));
    await screen.findByRole("alert");
    const data = mocks.save.mock.calls[0][1] as FormData;
    expect(data.get("opens_at")).toBe("2026-10-16T06:59:00.000");
    expect(data.get("closes_at")).toBe("2026-10-18T15:00:00.000");
    expect(data.get("original_opens_at")).toBe(schedule.assignment.opens_at);
  });
});
