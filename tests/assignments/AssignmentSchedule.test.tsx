// @vitest-environment jsdom
process.env.TZ = "UTC";
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
const formatDate = Date.prototype.toLocaleString;
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(Date, "now").mockReturnValue(now); mocks.save.mockResolvedValue(success);
  // Pin the language so displayed dates do not depend on this machine's locale.
  vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (this: Date, _locales, options) {
    return formatDate.call(this, "en-US", options);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
async function open() {
  const user = userEvent.setup();
  render(<AssignmentSchedule {...props} />);
  await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
  return user;
}
function changeClose(value = "2026-09-12T12:30") { fireEvent.change(screen.getByLabelText("Closes at — optional"), { target: { value } }); }
const save = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Save dates" }));

describe("simple assignment date editing", () => {
  it("prefills precision, disables unchanged Save, and cancels without writes", async () => {
    const user = await open();
    expect(screen.getByLabelText("Opens at — optional")).toHaveValue("2026-09-12T11:00");
    expect(screen.getByRole("button", { name: "Save dates" })).toBeDisabled();
    changeClose();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    expect(screen.getByLabelText("Closes at — optional")).toHaveValue("2026-09-12T12:01");
  });
  it("extends a deadline in one step with the existing IDs, original snapshot and confirmed receipt", async () => {
    const user = await open(); changeClose(); await save(user);
    expect(await screen.findByRole("status")).toHaveTextContent("Lewis dots — Chemistry A: Dates updated.");
    const data = mocks.save.mock.calls[0][1] as FormData;
    expect(data.get("assignment_id")).toBe(props.assignment.id);
    expect(data.get("class_id")).toBe(props.classId);
    expect(data.get("activity_id")).toBe(props.assignment.activity_id);
    expect(data.get("original_opens_at")).toBe(props.assignment.opens_at);
    expect(data.get("original_closes_at")).toBe(props.assignment.closes_at);
    expect(data.get("confirm_schedule_change")).toBe("");
    expect(data.get("closes_at")).toBe("2026-09-12T12:30:00.000");
    expect(data.get("opens_at")).toBe("2026-09-12T11:00:00.789");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByText("Sep 12, 2026, 12:30 PM UTC")).toHaveAttribute("datetime", success.savedAssignment?.closes_at);
  });
  it.each(["close", "postpone"])("confirms only an edit that immediately makes open work unavailable (%s)", async kind => {
    const user = await open();
    changeClose(kind === "close" ? "2026-09-12T12:00" : "2026-09-12T14:00");
    if (kind === "postpone") fireEvent.change(screen.getByLabelText("Opens at — optional"), { target: { value: "2026-09-12T13:00" } });
    await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable immediately");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Closes at — optional")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    await screen.findByRole("status");
    expect((mocks.save.mock.calls[0][1] as FormData).get("confirm_schedule_change")).toBe("true");
  });
  it("uses the save-time snapshot for a receipt after the old dashboard clock is stale", async () => {
    vi.mocked(Date.now).mockReturnValue(Date.parse("2026-09-12T13:00Z"));
    const user = await open(); changeClose(); await save(user); await screen.findByRole("status");
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });
  it("offers confirmation when the server determines an edit interrupts open work", async () => {
    mocks.save.mockResolvedValueOnce({ status: "error", message: "Confirm saving.", requiresConfirmation: true });
    const user = await open(); changeClose(); await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable immediately");
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    await screen.findByRole("status");
    expect((mocks.save.mock.calls[1][1] as FormData).get("confirm_schedule_change")).toBe("true");
  });
  it("rejects reversed dates, then permits blank bounds", async () => {
    const user = await open(); changeClose("2026-09-12T10:00"); await save(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("opening date must be earlier");
    expect(mocks.save).not.toHaveBeenCalled();
    changeClose(""); await save(user); await screen.findByRole("status");
    expect((mocks.save.mock.calls[0][1] as FormData).get("closes_at")).toBe("");
  });
  it.each(["returned", "thrown"])("retains drafts and permits retry after %s failures", async kind => {
    if (kind === "returned") mocks.save.mockResolvedValueOnce({ status: "error", message: "The dates could not be saved." });
    else mocks.save.mockRejectedValueOnce(new Error("private details"));
    const user = await open(); changeClose(); await save(user);
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private details");
    expect(screen.getByLabelText("Closes at — optional")).toHaveValue("2026-09-12T12:30");
    await save(user); expect(await screen.findByRole("status")).toHaveTextContent("Dates updated.");
  });
  it("locks fields/cancellation and prevents repeat saves while pending", async () => {
    let resolve!: (value: AssignmentFormState) => void;
    mocks.save.mockReturnValue(new Promise<AssignmentFormState>(done => { resolve = done; }));
    const user = await open(); changeClose(); await save(user);
    expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Closes at — optional")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Saving…" }));
    expect(mocks.save).toHaveBeenCalledOnce();
    await act(async () => { resolve(success); });
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
  it("blocks a stale draft and gives genuinely new server metadata precedence over the saved receipt", async () => {
    const user = userEvent.setup(); const view = render(<AssignmentSchedule {...props} />);
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" })); changeClose();
    view.rerender(<AssignmentSchedule {...props} assignment={{ ...props.assignment, closes_at: "2026-09-12T13:00Z" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("schedule changed");
    expect(screen.getByRole("button", { name: "Save dates" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    changeClose(); await save(user); await screen.findByRole("status");
    view.rerender(<AssignmentSchedule {...props} assignment={{ ...props.assignment, closes_at: "2026-09-12T14:00Z" }} />);
    expect(screen.getByText("Sep 12, 2026, 2:00 PM UTC")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("reopens closed work in one step without replacing its ID", async () => {
    mocks.save.mockResolvedValueOnce({ ...success, savedAssignment: { ...success.savedAssignment!, closes_at: null } });
    const user = userEvent.setup(); render(<AssignmentSchedule {...props} assignment={{ ...props.assignment, closes_at: "2026-09-12T11:30Z" }} />);
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" })); changeClose(""); await save(user);
    await screen.findByRole("status");
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect((mocks.save.mock.calls[0][1] as FormData).get("assignment_id")).toBe(props.assignment.id);
  });
  it("uses a stable dashboard snapshot without clocks and disables invalid schedules", () => {
    expect(renderToStaticMarkup(<AssignmentSchedule {...props} />)).toContain(">Open<");
    vi.useFakeTimers();
    const view = render(<AssignmentSchedule {...props} />);
    act(() => { vi.advanceTimersByTime(3_600_000); });
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(<AssignmentSchedule {...props} assignment={{ ...props.assignment, closes_at: "invalid" }} />);
    expect(screen.getByText("Schedule unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit dates for Lewis dots" })).toBeDisabled();
  });
});
