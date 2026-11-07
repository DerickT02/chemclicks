// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeacherClassSnapshot } from "@/lib/teacher-class-snapshot";

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn(), approve: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/teacher-class-updates", () => ({ subscribeTeacherClass: mocks.subscribe }));
vi.mock("@/app/admin/classes/roster-actions", () => ({ approveStudent: mocks.approve }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
import { LiveClassroomProvider } from "@/app/admin/LiveClassroomProvider";
import LiveStudentRoster from "@/app/admin/classes/LiveStudentRoster";
import { LiveActivityProgressSummary, LiveProgressStatus } from "@/app/admin/LiveActivityProgress";
import { progressFacts } from "../testing/progress";

const alice = { id: "alice", first_name: "Alice", last_name: "Student", student_id: "A", verified: false };
const bob = { ...alice, id: "bob", first_name: "Bob", student_id: "B" };
const progressStudent = (student: typeof alice) => ({ studentId: student.id, firstName: student.first_name, lastName: student.last_name,
  verified: student.verified, overallPercent: 0,
  lessons: [{ assignmentId: "assignment", activityId: "activity", activityTitle: "Bohr Models",
    progress: progressFacts({ stage: "not_started" }) }],
});
const baseline: TeacherClassSnapshot = { classId: "class", revision: "1", reset: true, removedStudentIds: [], attempts: null,
  roster: { pending: [alice, bob], active: [] }, progress: { classId: "class", className: "Chemistry", students: [progressStudent(alice), progressStudent(bob)] },
};
const fetchMock = vi.fn();
const reply = (data: TeacherClassSnapshot) => ({ ok: true, redirected: false, json: async () => data });
const tick = async (ms = 300_000) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const sync = async () => {
  act(() => { mocks.subscribe.mock.calls[0][1]({ kind: "sync" }); });
  await tick(250);
};
const view = (initial = baseline) => <LiveClassroomProvider classId="class" initialRoster={initial.roster} initialProgress={initial.progress}>
  <LiveStudentRoster classId="class" />
  <LiveProgressStatus />
  <LiveActivityProgressSummary classId="class" assignmentId="assignment" activityTitle="Bohr Models" />
</LiveClassroomProvider>;

beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(reply(baseline));
  mocks.subscribe.mockReturnValue(mocks.unsubscribe);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("one shared classroom data stream", () => {
  it("uses one request, subscription and fallback timer for both views", async () => {
    render(view());
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    await tick(299_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await tick(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/admin/classes/class/updates");
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/admin/classes/class/updates?after=1");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("updates only changed rows, preserving unchanged students and moving approvals to Active", async () => {
    render(view());
    await sync();
    fetchMock.mockResolvedValue(reply({ ...baseline, revision: "2", reset: false,
      roster: { pending: [], active: [{ ...alice, verified: true }] },
      progress: { ...baseline.progress!, students: [{ ...progressStudent(alice), verified: true, overallPercent: 100,
        lessons: [{ ...progressStudent(alice).lessons[0], progress: progressFacts({ stage: "completed" }) }] }] },
    }));
    act(() => { mocks.subscribe.mock.calls[0][1]({ kind: "progress", assignmentId: "assignment" }); });
    await tick(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/admin/classes/class/updates?after=1");
    expect(screen.getByRole("heading", { name: "Pending (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Active (1)" })).toBeInTheDocument();
    // Alice's changed row merges in; Bob's unchanged row is kept.
    expect(screen.getByText("2 students · 1 completed · 1 not started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Bob Student, Student ID B" })).toBeEnabled();
  });
  it("removes transferred/deleted students and keeps both views on a shared revision", async () => {
    render(view()); await sync();
    fetchMock.mockResolvedValue(reply({ ...baseline, revision: "2", reset: false, removedStudentIds: ["alice"],
      roster: { pending: [], active: [] }, progress: { ...baseline.progress!, students: [] },
    }));
    await tick();
    expect(screen.queryByText("Alice Student")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pending (1)" })).toBeInTheDocument();
    expect(screen.getByText("1 student · 1 not started")).toBeInTheDocument();
    await tick();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/admin/classes/class/updates?after=2");
  });
  it("keeps an in-flight bulk approval scoped to its original students across shared deltas", async () => {
    render(view()); await sync();
    let finish!: (state: { status: "success"; message: string }) => void;
    mocks.approve.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Approve all 2 pending students" })); });
    const submitted = mocks.approve.mock.calls[0][1] as FormData;
    expect(submitted.getAll("pending_id")).toEqual(["alice", "bob"]);
    const late = { ...alice, id: "late", first_name: "Late", student_id: "L" };
    fetchMock.mockResolvedValue(reply({ ...baseline, revision: "2", reset: false,
      roster: { pending: [late], active: [] }, progress: { ...baseline.progress!, students: [progressStudent(late)] },
    }));
    act(() => { mocks.subscribe.mock.calls[0][1]({ kind: "roster" }); });
    await tick(5_000);
    expect(screen.getByRole("button", { name: "Approve all 3 pending students" })).toBeDisabled();
    expect(submitted.getAll("pending_id")).toEqual(["alice", "bob"]);
    await act(async () => { finish({ status: "success", message: "2 students approved." }); });
    fetchMock.mockResolvedValue(reply({ ...baseline, revision: "3", reset: false,
      roster: { pending: [], active: [alice, bob].map(row => ({ ...row, verified: true })) },
      progress: { ...baseline.progress!, students: [alice, bob].map(row => ({ ...progressStudent(row), verified: true })) },
    }));
    await tick();
    expect(screen.getByRole("heading", { name: "Active (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Late Student, Student ID L" })).toBeEnabled();
    expect(screen.getByText("2 students approved.")).toBeInTheDocument();
    expect(mocks.approve).toHaveBeenCalledTimes(1);
  });
  it("immediately recovers a missing SSR resource without hiding the other valid resource", async () => {
    render(view({ ...baseline, roster: null }));
    expect(screen.getByText("2 students · 2 not started")).toBeInTheDocument();
    await tick(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Pending (2)" })).toBeInTheDocument();
  });
  it("retains both last good lists if the combined request fails", async () => {
    render(view()); await sync();
    fetchMock.mockRejectedValue(new Error("private details"));
    await tick();
    expect(screen.getByText(/Showing last loaded roster/)).toBeInTheDocument();
    expect(screen.getByText(/Showing last loaded progress/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pending (2)" })).toBeInTheDocument();
    expect(screen.queryByText(/private details/)).not.toBeInTheDocument();
  });
});
