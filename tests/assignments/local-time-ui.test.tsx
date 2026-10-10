// @vitest-environment jsdom
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
import { parseZonedInput } from "@/lib/datetime/time-zone";

let zone = "America/New_York";
const props = {
  classId: "11111111-1111-4111-8111-111111111111", className: "Chemistry A",
  activities: [{ id: "22222222-2222-4222-8222-222222222222", title: "Lewis dots", type: "lewis_diagram" as const, category: "Lewis", description: "Explore valence electrons", order_index: 1 }],
};
const schedule = {
  classId: props.classId, className: props.className, activityTitle: "Lewis dots", renderedAt: Date.parse("2026-09-12T12:00Z"),
  assignment: { id: "33333333-3333-4333-8333-333333333333", activity_id: props.activities[0].id, opens_at: "2026-11-01T05:30:00Z", closes_at: "2026-11-01T07:00:00Z" },
};
beforeEach(() => {
  vi.resetAllMocks();
  zone = "America/New_York";
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...original.call(this), timeZone: zone };
  });
  mocks.save.mockResolvedValue({ status: "success", message: "Activity assigned." });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const changeZone = (next: string) => act(() => { zone = next; window.dispatchEvent(new Event("focus")); });
const close = (value: string) => fireEvent.change(screen.getByLabelText("Closes at — optional"), { target: { value } });

describe("local scheduling and viewer dates", () => {
  it("hydrates UTC fallback without mismatches, then displays the viewer zone and exact instant", async () => {
    const element = <LocalizedTimestamp value="2026-09-12T19:00:00Z" />;
    const html = renderToString(element);
    expect(html).toContain("2026-09-12 19:00:00 UTC");
    expect(html).not.toContain("America/New_York");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const recover = vi.fn();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, element, { onRecoverableError: recover }); });
    expect(recover).not.toHaveBeenCalled();
    expect(container).toHaveTextContent("2026-09-12 15:00:00 UTC-4 (America/New_York)");
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-09-12T19:00:00Z");
    expect(container.querySelector("time")).toHaveAttribute("title", "Exact UTC: 2026-09-12T19:00:00.000Z");
    await act(async () => { root.unmount(); });
    container.remove();
  });
  it("submits teacher-local 3 PM in its pinned zone and shows the same instant as noon to another viewer", async () => {
    const user = userEvent.setup();
    render(<AssignmentForm {...props} />);
    await user.click(screen.getByRole("radio"));
    close("2026-09-12T15:00");
    changeZone("America/Los_Angeles");
    expect(screen.getByText(/Enter optional schedule times in America\/New_York/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Assign activity" }));
    const data = mocks.save.mock.calls[0][1] as FormData;
    expect(data.get("schedule_time_zone")).toBe("America/New_York");
    const utc = parseZonedInput(data.get("closes_at") as string, data.get("schedule_time_zone") as string);
    expect(utc).toBe("2026-09-12T19:00:00.000Z");
    render(<LocalizedTimestamp value={utc!} />);
    expect(screen.getByText("2026-09-12 12:00:00 UTC-7 (America/Los_Angeles)")).toHaveAttribute("datetime", utc);
  });
  it("requires a repeated-hour choice and preserves that choice through identical failed submissions", async () => {
    mocks.save.mockResolvedValue({ status: "error", message: "Try again." });
    const user = userEvent.setup();
    render(<AssignmentForm {...props} />);
    await user.click(screen.getByRole("radio"));
    close("2026-11-01T01:30");
    const select = screen.getByLabelText("Closes at: choose which repeated time");
    expect(select).toBeRequired();
    await user.click(screen.getByRole("button", { name: "Assign activity" }));
    expect(mocks.save).not.toHaveBeenCalled();
    await user.selectOptions(select, "later");
    for (let attempt = 0; attempt < 2; attempt++) {
      await user.click(screen.getByRole("button", { name: "Assign activity" }));
      await screen.findByRole("alert");
      expect(screen.getByLabelText("Closes at: choose which repeated time")).toHaveValue("later");
    }
    expect((mocks.save.mock.calls[0][1] as FormData).get("closes_at_occurrence")).toBe("later");
  });
  it("shows nonexistent local times rather than silently adjusting them", () => {
    render(<AssignmentForm {...props} />);
    close("2026-03-08T02:30");
    expect(screen.getByRole("alert")).toHaveTextContent("does not exist");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("prefills an existing repeated time's actual occurrence and preserves original snapshot values", async () => {
    mocks.save.mockResolvedValue({ status: "error", message: "Could not save." });
    const user = userEvent.setup();
    render(<AssignmentSchedule {...schedule} />);
    await user.click(screen.getByRole("button", { name: "Edit dates for Lewis dots" }));
    expect(screen.getByLabelText("Opens at (America/New_York) — optional")).toHaveValue("2026-11-01T01:30");
    expect(screen.getByLabelText("Opens at: choose which repeated time")).toHaveValue("earlier");
    fireEvent.change(screen.getByLabelText("Closes at (America/New_York) — optional"), { target: { value: "2026-11-01T03:00" } });
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    await user.click(screen.getByRole("button", { name: "Confirm save dates" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Opens at: choose which repeated time")).toHaveValue("earlier");
    const data = mocks.save.mock.calls[0][1] as FormData;
    expect(data.get("original_opens_at")).toBe(schedule.assignment.opens_at);
    expect(data.get("opens_at_occurrence")).toBe("earlier");
    expect(data.get("schedule_time_zone")).toBe("America/New_York");
  });
  it("requires an explicit UTC fallback when device-zone detection fails", async () => {
    zone = "unknown-zone";
    const user = userEvent.setup();
    render(<AssignmentForm {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be detected");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use UTC instead" }));
    expect(screen.getByText(/Enter optional schedule times in UTC/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio"));
    await user.click(screen.getByRole("button", { name: "Assign activity" }));
    expect((mocks.save.mock.calls[0][1] as FormData).get("schedule_time_zone")).toBe("UTC");
  });
  it("does not emit invalid time elements and cleans up the shared focus subscription", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const view = render(<><LocalizedTimestamp value="bad" /><LocalizedTimestamp value="2026-09-12T19:00Z" /></>);
    expect(screen.getByText("Date unavailable")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="bad"]')).toBeNull();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("focus", expect.any(Function));
  });
});
