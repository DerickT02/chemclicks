// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/admin/assignments/actions", () => ({ saveAssignment: mocks.save }));
import AssignmentSchedule from "@/app/admin/assignments/AssignmentSchedule";
import type { AssignmentFormState } from "@/app/admin/assignments/actions";
const now = Date.parse("2026-09-12T12:00Z");
const props = {
  classId: "11111111-1111-4111-8111-111111111111", className: "Chemistry A", activityTitle: "Lewis dots", renderedAt: now,
  assignment: { id: "22222222-2222-4222-8222-222222222222", activity_id: "33333333-3333-4333-8333-333333333333", opens_at: "2026-09-12T11:00:00.789+00:00", closes_at: "2026-09-12T12:01:00+00:00" },
};
const success: AssignmentFormState = { status: "success", message: "Dates updated.", savedAssignment: {
  ...props.assignment, class_id: props.classId, closes_at: "2026-09-12T12:30:00+00:00",
} };
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(Date, "now").mockReturnValue(now); mocks.save.mockResolvedValue(success); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
async function open() {
  const user = userEvent.setup();
  render(<AssignmentSchedule {...props} />);
  await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
  return user;
}
function changeClose(value = "2026-09-12T12:30") { fireEvent.change(screen.getByLabelText("Closes at (UTC) — optional"), { target: { value } }); }
async function review(user: ReturnType<typeof userEvent.setup>) {
  changeClose();
  await user.click(screen.getByRole("button", { name: "Review changes" }));
}

describe("assignment schedule editor", () => {
  it("prefills UTC including milliseconds and cancels without writes", async () => {
    const user = await open();
    expect(screen.getByLabelText("Opens at (UTC) — optional")).toHaveValue("2026-09-12T11:00:00.789");
    expect(screen.getByRole("button", { name: "Review changes" })).toBeDisabled();
    await review(user);
    expect(screen.getByText(/Existing exploration attempts will be kept/)).toBeInTheDocument();
    expect(screen.getByText(/interrupt currently open work/)).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    expect(screen.getByLabelText("Closes at (UTC) — optional")).toHaveValue("2026-09-12T12:01");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("saves the existing IDs and snapshot only after confirmation, and displays confirmed dates", async () => {
    const user = await open();
    await review(user);
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Lewis dots — Chemistry A: Dates updated.");
    const data = mocks.save.mock.calls[0][1] as FormData;
    expect(data.get("class_id")).toBe(props.classId);
    expect(data.get("assignment_id")).toBe(props.assignment.id);
    expect(data.get("activity_id")).toBe(props.assignment.activity_id);
    expect(data.get("original_opens_at")).toBe(props.assignment.opens_at);
    expect(data.get("original_closes_at")).toBe(props.assignment.closes_at);
    expect(data.get("confirm_schedule_change")).toBe("true");
    expect(data.get("closes_at")).toBe("2026-09-12T12:30");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByText("2026-09-12 12:30:00 UTC")).toHaveAttribute("datetime", success.savedAssignment?.closes_at);
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    expect(screen.getByLabelText("Closes at (UTC) — optional")).toHaveValue("2026-09-12T12:30");
  });
  it("allows blank bounds, but rejects equal/reversed dates before invoking the action", async () => {
    const user = await open();
    changeClose("2026-09-12T10:00");
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("opening date must be earlier");
    expect(mocks.save).not.toHaveBeenCalled();
    changeClose("");
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    expect((mocks.save.mock.calls[0][1] as FormData).get("closes_at")).toBe("");
  });
  it.each(["returned", "thrown"])("retains drafts and supports retry after %s failures", async kind => {
    if (kind === "returned") mocks.save.mockResolvedValueOnce({ status: "error", message: "The dates could not be saved." });
    else mocks.save.mockRejectedValueOnce(new Error("private network details"));
    const user = await open();
    await review(user);
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private network");
    expect(screen.getByLabelText("Closes at (UTC) — optional")).toHaveValue("2026-09-12T12:30");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Dates updated.");
  });
  it("prevents duplicate confirmation, field edits, and cancellation while pending", async () => {
    let resolve!: (value: AssignmentFormState) => void;
    mocks.save.mockReturnValue(new Promise<AssignmentFormState>(done => { resolve = done; }));
    const user = await open();
    await review(user);
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Closes at (UTC) — optional")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Saving…" }));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(success); });
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
  it("blocks stale drafts after server metadata changes, and accepts newer server data after saving", async () => {
    const user = userEvent.setup();
    const view = render(<AssignmentSchedule {...props} />);
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    changeClose();
    view.rerender(<AssignmentSchedule {...props} assignment={{ ...props.assignment, closes_at: "2026-09-12T13:00Z" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("schedule changed");
    expect(screen.getByRole("button", { name: "Review changes" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    expect(screen.getByLabelText("Closes at (UTC) — optional")).toHaveValue("2026-09-12T13:00");
    await review(user);
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    await screen.findByRole("status");
    view.rerender(<AssignmentSchedule {...props} assignment={{ ...props.assignment, closes_at: "2026-09-12T14:00Z" }} />);
    expect(screen.getByText("2026-09-12 14:00:00 UTC")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    view.rerender(<AssignmentSchedule {...props} assignment={{ ...props.assignment }} />);
    expect(screen.getByText("2026-09-12 12:01:00 UTC")).toBeInTheDocument();
  });
  it("renders stable SSR status and disables malformed schedules", () => {
    expect(renderToStaticMarkup(<AssignmentSchedule {...props} />)).toContain(">Open<");
    render(<AssignmentSchedule {...props} assignment={{ ...props.assignment, closes_at: "invalid" }} />);
    expect(screen.getByText("Schedule unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit dates for Lewis dots" })).toBeDisabled();
  });
  it("reopens closed work without replacing the assignment ID", async () => {
    mocks.save.mockResolvedValueOnce({ ...success, savedAssignment: { ...success.savedAssignment!, closes_at: null } });
    const user = userEvent.setup();
    render(<AssignmentSchedule {...props} assignment={{ ...props.assignment, closes_at: "2026-09-12T11:30Z" }} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    changeClose("");
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    await screen.findByRole("status");
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("No deadline")).toBeInTheDocument();
    expect((mocks.save.mock.calls[0][1] as FormData).get("assignment_id")).toBe(props.assignment.id);
  });
  it("rechecks clock changes on focus and bounds long deadline timers", () => {
    vi.restoreAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
    const timer = vi.spyOn(globalThis, "setTimeout");
    const view = render(<AssignmentSchedule {...props} assignment={{ ...props.assignment, opens_at: "2027-01-01T00:00Z", closes_at: null }} />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(timer.mock.calls.every(([, delay]) => (delay ?? 0) <= 2_147_483_647)).toBe(true);
    act(() => { vi.setSystemTime(new Date("2027-01-01T00:00Z")); globalThis.window.dispatchEvent(new Event("focus")); });
    expect(screen.getByText("Open")).toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("updates at the exact opening/closing boundaries and cleans up clock timers", () => {
    vi.restoreAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
    const view = render(<AssignmentSchedule {...props} assignment={{ ...props.assignment, opens_at: "2026-09-12T12:00:01Z", closes_at: "2026-09-12T12:00:02Z" }} />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("Open")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("Closed")).toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
