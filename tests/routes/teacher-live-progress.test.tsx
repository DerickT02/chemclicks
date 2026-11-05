// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassChange } from "@/lib/teacher-class-updates";
import type { TeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

const realtime = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/teacher-class-updates", () => ({ subscribeTeacherClass: realtime.subscribe }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: realtime.refresh }) }));
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import { LiveActivityProgressSummary, LiveProgressStatus } from "@/app/admin/LiveActivityProgress";
import { LiveClassroomProvider } from "@/app/admin/LiveClassroomProvider";
import { LiveStudentProgress } from "@/app/admin/classes/[classId]/activities/[assignmentId]/LiveStudentProgress";

const fetchMock = vi.fn();
const seed = { value: "initial" };
const reply = (data: unknown) => ({ ok: true, redirected: false, json: async () => data });
const tick = async (ms = 300_000) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const change = async (event: ClassChange) => {
  act(() => { realtime.subscribe.mock.calls.forEach(([, callback]) => callback(event)); });
  await tick(250);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  revision = 0;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(reply(seed));
  realtime.subscribe.mockReturnValue(realtime.unsubscribe);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("event-driven teacher progress", () => {
  it("reuses SSR data and makes only one fallback request per five minutes", async () => {
    const { result } = renderHook(() => useLiveTeacherProgress("/progress", seed));
    await tick(299_999);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(reply({ value: "completed" }));
    await tick(1);
    expect(result.current).toEqual({ data: { value: "completed" }, failed: false });
    expect(fetchMock).toHaveBeenLastCalledWith("/progress", expect.objectContaining({ cache: "no-store", credentials: "same-origin", signal: expect.any(AbortSignal) }));
    await tick(600_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("coalesces broadcast bursts and filters unrelated resources and assignments", async () => {
    renderHook(() => useLiveTeacherProgress("/roster", seed, { classId: "class", resource: "roster" }));
    renderHook(() => useLiveTeacherProgress("/attempts", seed, { classId: "class", assignmentId: "selected" }));
    await change({ kind: "progress", assignmentId: "other" });
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => { for (let i = 0; i < 100; i++) realtime.subscribe.mock.calls.forEach(([, cb]) => cb({ kind: "progress", assignmentId: "selected" })); });
    await tick(250);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/attempts");
    await change({ kind: "roster" });
    await tick(5_000);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/attempts", "/roster", "/attempts"]);
  });

  it("does not render unchanged responses", async () => {
    let renders = 0;
    renderHook(() => { renders++; return useLiveTeacherProgress("/progress", seed); });
    const initialRenders = renders;
    fetchMock.mockImplementation(async () => reply({ ...seed }));
    await tick(900_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(renders).toBe(initialRenders);
  });

  it("retains good data on failure, backs off 10/15/15 minutes, and clears warnings on recovery", async () => {
    const { result } = renderHook(() => useLiveTeacherProgress("/progress", seed, { classId: "class" }));
    fetchMock.mockRejectedValue(new Error("offline"));
    await tick();
    expect(result.current).toEqual({ data: seed, failed: true });
    await change({ kind: "sync" });
    await tick(599_749);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await tick(900_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockResolvedValue(reply({ value: "completed" }));
    await tick(900_000);
    expect(result.current.failed).toBe(false);
    expect(result.current.data?.value).toBe("completed");
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it.each([
    { ok: false, redirected: false },
    { ok: true, redirected: true },
    { ok: true, redirected: false, json: async () => { throw new Error("HTML login page"); } },
  ])("retains data on invalid responses (%j)", async response => {
    fetchMock.mockResolvedValue(response);
    const { result } = renderHook(() => useLiveTeacherProgress("/progress", seed));
    await tick();
    expect(result.current).toEqual({ data: seed, failed: true });
  });

  it("pauses hidden/offline reads and coalesces visibility, focus and online events", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    renderHook(() => useLiveTeacherProgress("/progress", seed));
    await tick(600_000);
    expect(fetchMock).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
    await tick(250);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    online.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event("online")); });
    await tick(250);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("releases paid message recipients while hidden/offline and rejoins on return", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    const online = vi.spyOn(navigator, "onLine", "get");
    renderHook(() => useLiveTeacherProgress("/progress", seed, { classId: "class" }));
    expect(realtime.subscribe).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("hidden");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(realtime.unsubscribe).toHaveBeenCalledTimes(1);
    await tick(900_000);
    expect(fetchMock).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await tick(250);
    expect(realtime.subscribe).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    online.mockReturnValue(false);
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(realtime.unsubscribe).toHaveBeenCalledTimes(2);
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    online.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event("online")); });
    await tick(250);
    expect(realtime.subscribe).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not join Realtime for a tab that starts hidden", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    renderHook(() => useLiveTeacherProgress("/progress", seed, { classId: "class" }));
    await tick(900_000);
    expect(realtime.subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queues changes arriving during an in-flight read without overlapping requests", async () => {
    let finish!: (value: ReturnType<typeof reply>) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    renderHook(() => useLiveTeacherProgress("/progress", null, { classId: "class" }));
    await change({ kind: "progress" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { finish(reply(seed)); });
    await tick(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts requests and cleans up timers, subscription and listeners on unmount", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderHook(() => useLiveTeacherProgress("/progress", null, { classId: "class" }));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(realtime.unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out stalled reads and retries after backoff", async () => {
    fetchMock.mockImplementationOnce((_url: string, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const { result } = renderHook(() => useLiveTeacherProgress("/progress", null));
    await tick(15_000);
    expect(result.current.failed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await tick(600_000);
    expect(result.current.failed).toBe(false);
  });

  it("ignores late responses after navigation and accepts refreshed server snapshots", async () => {
    let finish!: (value: ReturnType<typeof reply>) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ url, initial }) => useLiveTeacherProgress<{ value: string }>(url, initial), {
      initialProps: { url: "/class-a", initial: null as { value: string } | null },
    });
    const next = { value: "class B" };
    rerender({ url: "/class-b", initial: next });
    await act(async () => { finish(reply({ value: "late class A" })); });
    expect(result.current.data).toEqual(next);
    const refreshed = { value: "server refresh" };
    rerender({ url: "/class-b", initial: refreshed });
    expect(result.current.data).toEqual(refreshed);
  });

  it("keeps cached history and reports failures when a previously loaded resource is re-enabled", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useLiveTeacherProgress<{ value: string }>("/history", null, { enabled }), {
      initialProps: { enabled: true },
    });
    await tick(0);
    expect(result.current).toEqual({ data: seed, failed: false });
    rerender({ enabled: false });
    fetchMock.mockRejectedValue(new Error("offline"));
    rerender({ enabled: true });
    await tick(0);
    expect(result.current).toEqual({ data: seed, failed: true });
  });

  it("falls back if Realtime setup throws", async () => {
    realtime.subscribe.mockImplementation(() => { throw new Error("unavailable"); });
    renderHook(() => useLiveTeacherProgress("/progress", seed, { classId: "class" }));
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

const progress: TeacherClassLessonProgress = {
  classId: "class", className: "Chemistry", students: [{
    studentId: "student", firstName: "Mina", lastName: "Chen", verified: true, overallPercent: 0,
    lessons: [{ assignmentId: "assignment", activityId: "activity", activityTitle: "Bohr Models", status: "not_started", stage: "not_started" }],
  }],
};
let revision = 0;
const snapshot = (data: TeacherClassLessonProgress) => ({
  classId: "class", revision: String(++revision), reset: true, removedStudentIds: [],
  roster: { pending: [], active: [] }, progress: data, attempts: null,
});
const classView = (initialProgress: TeacherClassLessonProgress | null) => (
  <LiveClassroomProvider classId="class" initialRoster={{ pending: [], active: [] }} initialProgress={initialProgress}>
    <LiveProgressStatus />
    <LiveActivityProgressSummary classId="class" assignmentId="assignment" activityTitle="Bohr Models" />
  </LiveClassroomProvider>
);

describe("teacher live views", () => {
  it("updates named statuses and percentages on broadcast, and displays stale-data warnings", async () => {
    render(classView(progress));
    expect(screen.getByText("1 student · 1 not started")).toBeTruthy();
    fetchMock.mockResolvedValue(reply(snapshot({ ...progress, students: [{ ...progress.students[0], overallPercent: 100,
      lessons: [{ ...progress.students[0].lessons[0], status: "completed", stage: "completed" }],
    }] })));
    await change({ kind: "progress" });
    expect(screen.getByText("1 student · 1 completed")).toBeTruthy();
    fetchMock.mockRejectedValue(new Error("offline"));
    await tick();
    expect(screen.getByRole("status").textContent).toContain("Showing last loaded progress");
    expect(screen.getByText("1 student · 1 completed")).toBeTruthy();
  });

  it("recovers automatically from an initial lesson-load failure", async () => {
    fetchMock.mockRejectedValue(new Error("unavailable"));
    render(classView(null));
    await tick(0);
    expect(screen.getByText(/Student progress could not be loaded/)).toBeTruthy();
    expect(screen.getByText("Progress unavailable.")).toBeTruthy();
    expect(screen.queryByText("No students in this class yet.")).toBeNull();
    fetchMock.mockResolvedValue(reply(snapshot(progress)));
    await tick(600_000);
    expect(screen.queryByText(/Student progress could not be loaded/)).toBeNull();
    expect(screen.getByText("1 student · 1 not started")).toBeTruthy();
  });

  it("fetches history only while expanded and keeps it open across overview updates", async () => {
    const student: TeacherActivityAttemptSummary["students"][number] = {
      studentId: "student", firstName: "Mina", lastName: "Chen", verified: true,
      attemptCount: 1, completedCount: 0, inProgressCount: 1, overallStatus: "exploring",
      explorationStatus: "in_progress", explorationDurationSeconds: null, passingQuizAttemptNumber: null,
      passingQuizScore: null, passingQuizTotal: null, passingQuizPercentage: null, passingQuizCompletedAt: null,
      failedQuizAttemptCount: 0, attempts: [],
    };
    const summary: TeacherActivityAttemptSummary = { classId: "class", className: "Chemistry", assignmentId: "selected", activityId: "activity", activityTitle: "Bohr Models", students: [student] };
    render(<LiveStudentProgress initialSummary={summary} />);
    await tick(299_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).toBeNull();
    fetchMock.mockImplementation(async (url: string) => reply(url.includes("attempt-history") ? [{ id: "attempt", attemptNumber: 1, status: "in_progress", startedAt: "2026-09-23T12:00:00Z", completedAt: null }] : {
      classId: "class", revision: "1", reset: true, removedStudentIds: [], roster: null, progress: null, attempts: summary,
    }));
    const details = screen.getByText("View attempt history for Mina Chen").closest("details")!;
    act(() => { details.open = true; fireEvent(details, new Event("toggle")); });
    await tick(0);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe("/admin/classes/class/attempt-history?assignmentId=selected&studentId=student");
    await change({ kind: "progress", assignmentId: "selected" });
    await tick(5_000);
    expect(details.open).toBe(true);
    act(() => { details.open = false; fireEvent(details, new Event("toggle")); });
    const historyRequests = fetchMock.mock.calls.filter(([url]) => url.includes("attempt-history")).length;
    await tick(600_000);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("attempt-history"))).toHaveLength(historyRequests);
  });
});
