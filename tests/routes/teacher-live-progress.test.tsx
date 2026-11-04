// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveTeacherProgress } from "@/components/assignments/useLiveTeacherProgress";
import { LiveLessonProgress } from "@/app/admin/LiveLessonProgress";
import { LiveAttemptRoster } from "@/app/admin/classes/[classId]/attempts/LiveAttemptRoster";
import type { TeacherClassLessonProgress } from "@/lib/server/teacher-lesson-progress";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";

const fetchMock = vi.fn();
const seed = { value: "initial" };
const reply = (data: unknown) => ({ ok: true, redirected: false, json: async () => data });
const tick = async (ms = 5_000) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(reply(seed));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("live progress lifecycle", () => {
  it("uses the server snapshot and updates without reloading, using uncached same-origin reads", async () => {
    const { result } = renderHook(() => useLiveTeacherProgress("/progress", seed));
    expect(result.current.data).toEqual(seed);
    await tick(0);
    fetchMock.mockResolvedValue(reply({ value: "completed" }));
    await tick();
    expect(result.current).toEqual({ data: { value: "completed" }, failed: false });
    expect(fetchMock).toHaveBeenLastCalledWith("/progress", expect.objectContaining({
      cache: "no-store", credentials: "same-origin", signal: expect.any(AbortSignal),
    }));
  });

  it("retains the latest good snapshot on failure and clears the warning on recovery", async () => {
    const updated = { value: "in progress" };
    fetchMock.mockResolvedValue(reply(updated));
    const { result } = renderHook(() => useLiveTeacherProgress("/progress", seed));
    await tick(0);
    fetchMock.mockRejectedValue(new Error("offline"));
    await tick();
    expect(result.current).toEqual({ data: updated, failed: true });
    fetchMock.mockResolvedValue(reply({ value: "completed" }));
    await tick();
    expect(result.current.failed).toBe(false);
    expect(result.current.data?.value).toBe("completed");
  });

  it.each([
    { ok: false, redirected: false },
    { ok: true, redirected: true },
    { ok: true, redirected: false, json: async () => { throw new Error("HTML login page"); } },
  ])("does not replace data with a failed/redirected/non-JSON response (%j)", async response => {
    fetchMock.mockResolvedValue(response);
    const { result } = renderHook(() => useLiveTeacherProgress("/progress", seed));
    await tick(0);
    expect(result.current).toEqual({ data: seed, failed: true });
  });

  it("pauses hidden/offline requests and checks immediately on visibility, focus, and reconnection", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    renderHook(() => useLiveTeacherProgress("/progress", seed));
    await tick(10_000);
    expect(fetchMock).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    online.mockReturnValue(true);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not overlap requests and aborts/cleans up on unmount", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderHook(() => useLiveTeacherProgress("/progress", seed));
    await tick(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out stalled requests and retries", async () => {
    fetchMock.mockImplementation((_url: string, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const { result } = renderHook(() => useLiveTeacherProgress("/progress", seed));
    await tick(14_999);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    fetchMock.mockResolvedValue(reply(seed));
    await tick(5_001);
    expect(signal.aborted).toBe(true);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.failed).toBe(false);
  });

  it("ignores late responses after class/assignment changes and accepts new server snapshots", async () => {
    let resolveOld!: (value: ReturnType<typeof reply>) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(({ url, initial }) => useLiveTeacherProgress(url, initial), {
      initialProps: { url: "/class-a", initial: seed },
    });
    const next = { value: "class B" };
    fetchMock.mockResolvedValue(reply(next));
    rerender({ url: "/class-b", initial: next });
    await tick(0);
    await act(async () => { resolveOld(reply({ value: "late class A" })); });
    expect(result.current.data).toEqual(next);
    const refreshed = { value: "server refresh" };
    fetchMock.mockReturnValue(new Promise(() => {}));
    rerender({ url: "/class-b", initial: refreshed });
    expect(result.current.data).toEqual(refreshed);
  });
});

const progress: TeacherClassLessonProgress = {
  classId: "class", className: "Chemistry", students: [{
    studentId: "student", firstName: "Mina", lastName: "Chen", verified: true, overallPercent: 0,
    lessons: [{ assignmentId: "assignment", activityId: "activity", activityTitle: "Bohr Models", status: "not_started" }],
  }],
};

describe("teacher live views", () => {
  it("updates named lesson statuses and percentages, and displays stale-data warnings", async () => {
    fetchMock.mockResolvedValue(reply(progress));
    render(<LiveLessonProgress classId="class" initialProgress={progress} />);
    await tick(0);
    expect(screen.getByText("Bohr Models: Not started")).toBeTruthy();
    fetchMock.mockResolvedValue(reply({ ...progress, students: [{ ...progress.students[0], overallPercent: 100,
      lessons: [{ ...progress.students[0].lessons[0], status: "completed" }],
    }] }));
    await tick();
    expect(screen.getByText("Bohr Models: Completed")).toBeTruthy();
    expect(screen.getByText("100% complete")).toBeTruthy();
    fetchMock.mockRejectedValue(new Error("offline"));
    await tick();
    expect(screen.getByRole("status").textContent).toContain("Showing last loaded progress");
    expect(screen.getByText("100% complete")).toBeTruthy();
  });

  it("recovers automatically from an initial lesson-load failure without showing a false empty roster", async () => {
    fetchMock.mockRejectedValue(new Error("unavailable"));
    render(<LiveLessonProgress classId="class" initialProgress={null} />);
    await tick(0);
    expect(screen.getByText(/Student progress could not be loaded/)).toBeTruthy();
    expect(screen.queryByText("No students in this class yet.")).toBeNull();
    fetchMock.mockResolvedValue(reply(progress));
    await tick();
    expect(screen.getByText("Mina Chen")).toBeTruthy();
  });

  it("updates the selected assignment's attempt roster in place", async () => {
    const summary: TeacherActivityAttemptSummary = {
      classId: "class", className: "Chemistry", assignmentId: "selected", activityId: "activity", activityTitle: "Bohr Models", students: [],
    };
    fetchMock.mockResolvedValue(reply(summary));
    render(<LiveAttemptRoster initialSummary={summary} />);
    await tick(0);
    const updated: TeacherActivityAttemptSummary = { ...summary, students: [{
      studentId: "student", firstName: "Mina", lastName: "Chen", verified: true,
      attemptCount: 1, completedCount: 0, inProgressCount: 1, overallStatus: "exploring",
      explorationStatus: "in_progress", explorationDurationSeconds: null, passingQuizAttemptNumber: null,
      passingQuizScore: null, passingQuizTotal: null, passingQuizPercentage: null, passingQuizCompletedAt: null,
      failedQuizAttemptCount: 0, attempts: [{ id: "attempt", attemptNumber: 1, status: "in_progress",
        startedAt: "2026-09-23T12:00:00Z", completedAt: null }],
    }] };
    fetchMock.mockResolvedValue(reply(updated));
    await tick();
    expect(screen.getByText("Mina Chen")).toBeTruthy();
    expect(screen.getAllByText("Exploring")).toHaveLength(2);
    const details = screen.getByText("View attempt history for Mina Chen").closest("details")!;
    details.open = true;
    await tick();
    expect(details.open).toBe(true);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/admin/classes/class/progress?assignmentId=selected");
  });
});
