// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentRoster as Roster } from "@/lib/server/student-roster";

const mocks = vi.hoisted(() => ({ approve: vi.fn(), refresh: vi.fn(), subscribe: vi.fn() }));
vi.mock("@/app/admin/classes/roster-actions", () => ({ approveStudent: mocks.approve }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/teacher-class-updates", () => ({ subscribeTeacherClass: mocks.subscribe }));
import LiveStudentRoster from "@/app/admin/classes/LiveStudentRoster";

const fetchMock = vi.fn();
const student = { id: "first", first_name: "Alex", last_name: "Waiting", student_id: "TEST1", verified: false };
const second = { ...student, id: "second", first_name: "Sam", student_id: "TEST2" };
const empty: Roster = { pending: [], active: [] };
const roster: Roster = { pending: [student], active: [] };
const reply = (data: Roster) => ({ ok: true, redirected: false, json: async () => data });
const tick = async (ms = 60_000) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const pendingList = () => within(screen.getByRole("region", { name: "Pending students" }));
const activeList = () => within(screen.getByRole("region", { name: "Active students" }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(reply(empty));
  mocks.subscribe.mockReturnValue(() => {});
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("live student approvals", () => {
  it("shows new requests, accurate counts, and approval controls without refreshing the page", async () => {
    render(<LiveStudentRoster classId="class" initialRoster={empty} />);
    await tick(0);
    expect(screen.getByRole("heading", { name: "Pending (0)" })).toBeInTheDocument();
    fetchMock.mockResolvedValue(reply({ pending: [student, second], active: [] }));
    await tick();
    expect(screen.getByRole("heading", { name: "Pending (2)" })).toBeInTheDocument();
    expect(pendingList().getByRole("cell", { name: "TEST1" })).toBeInTheDocument();
    expect(pendingList().getByRole("cell", { name: "TEST2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve all 2 pending students" })).toBeEnabled();
    expect(fetchMock).toHaveBeenLastCalledWith("/admin/classes/class/roster", expect.objectContaining({ cache: "no-store" }));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("moves externally approved students to Active on the next check", async () => {
    fetchMock.mockResolvedValue(reply(roster));
    render(<LiveStudentRoster classId="class" initialRoster={roster} />);
    await tick(0);
    fetchMock.mockResolvedValue(reply({ pending: [], active: [{ ...student, verified: true }] }));
    await tick();
    expect(screen.getByRole("heading", { name: "Pending (0)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Active (1)" })).toBeInTheDocument();
    expect(activeList().getByRole("cell", { name: "TEST1" })).toBeInTheDocument();
    expect(pendingList().queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("retains the last roster with a warning on failure and recovers automatically", async () => {
    fetchMock.mockResolvedValue(reply(roster));
    render(<LiveStudentRoster classId="class" initialRoster={roster} />);
    await tick(0);
    fetchMock.mockRejectedValue(new Error("private connection details"));
    await tick();
    expect(screen.getByText(/Showing last loaded roster/)).toBeInTheDocument();
    expect(pendingList().getByRole("cell", { name: "TEST1" })).toBeInTheDocument();
    expect(screen.queryByText(/private connection/)).not.toBeInTheDocument();
    fetchMock.mockResolvedValue(reply({ pending: [student, second], active: [] }));
    await tick(120_000);
    expect(screen.queryByText(/Showing last loaded roster/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pending (2)" })).toBeInTheDocument();
  });

  it("recovers from an initial read failure without reporting false zero counts", async () => {
    fetchMock.mockRejectedValue(new Error("unavailable"));
    render(<LiveStudentRoster classId="class" initialRoster={null} />);
    await tick(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Retrying automatically");
    expect(screen.getByRole("button", { name: "Retry student roster" })).toBeInTheDocument();
    expect(screen.queryByText("No pending students.")).not.toBeInTheDocument();
    fetchMock.mockResolvedValue(reply(roster));
    await tick(120_000);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(pendingList().getByRole("cell", { name: "TEST1" })).toBeInTheDocument();
  });

  it("preserves an in-flight bulk approval and its submitted IDs when new requests arrive", async () => {
    const initial: Roster = { pending: [student, second], active: [] };
    const late = { ...student, id: "late", first_name: "Late", student_id: "LATE" };
    fetchMock.mockResolvedValue(reply(initial));
    let finish!: (state: { status: "success"; message: string }) => void;
    mocks.approve.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<LiveStudentRoster classId="class" initialRoster={initial} />);
    await tick(0);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Approve all 2 pending students" })); });
    const submitted = mocks.approve.mock.calls[0][1] as FormData;
    expect(submitted.get("class_id")).toBe("class");
    expect(submitted.getAll("pending_id")).toEqual(["first", "second"]);
    fetchMock.mockResolvedValue(reply({ pending: [student, second, late], active: [] }));
    await tick();
    expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Approve all 3 pending students" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Approve Late Waiting, Student ID LATE" })).toBeDisabled();
    expect(submitted.getAll("pending_id")).toEqual(["first", "second"]);
    await act(async () => { finish({ status: "success", message: "2 students approved." }); });
    fetchMock.mockResolvedValue(reply({ pending: [late], active: [student, second].map(row => ({ ...row, verified: true })) }));
    await tick();
    expect(screen.getByText("2 students approved.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pending (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Active (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Late Waiting, Student ID LATE" })).toBeEnabled();
    expect(mocks.approve).toHaveBeenCalledTimes(1);
  });

  it("does not show another class's late roster response after navigation", async () => {
    let resolveOld!: (response: ReturnType<typeof reply>) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    const { rerender } = render(<LiveStudentRoster key="class-a" classId="class-a" initialRoster={roster} />);
    await tick();
    const next: Roster = { pending: [second], active: [] };
    fetchMock.mockResolvedValue(reply(next));
    rerender(<LiveStudentRoster key="class-b" classId="class-b" initialRoster={next} />);
    await tick();
    await act(async () => { resolveOld(reply(roster)); });
    expect(pendingList().queryByRole("cell", { name: "TEST1" })).not.toBeInTheDocument();
    expect(pendingList().getByRole("cell", { name: "TEST2" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/admin/classes/class-b/roster");
  });
});
