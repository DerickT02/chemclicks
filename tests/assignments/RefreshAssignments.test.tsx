// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { StrictMode } from "react";
const mocks = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
import RefreshAssignments from "@/components/assignments/RefreshAssignments";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-01T12:00:00Z"));
  mocks.router.refresh.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("refreshing student assignment metadata", () => {
  it("renders an honest SSR control and refreshes on manual request, interval and focus", () => {
    expect(renderToString(<RefreshAssignments />)).toContain("Refresh assignments");
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    render(<RefreshAssignments />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh assignments" }));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(2);
    fireEvent(window, new Event("focus"));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(/updated|saved|success/i)).not.toBeInTheDocument();
  });

  it("checks a nearby opening/closing without overflowing distant timers", () => {
    const start = Date.now();
    const { rerender } = render(<RefreshAssignments nextChangeAt={start + 5_000} checkedAt={start} />);
    act(() => { vi.advanceTimersByTime(5_025); });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    rerender(<RefreshAssignments nextChangeAt={Date.parse("9999-01-01T00:00:00Z")} checkedAt={Date.now()} />);
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("reconsiders a long deadline on a fresh snapshot and cleans up obsolete deadlines/listeners", () => {
    const start = Date.now();
    const { rerender, unmount } = render(<StrictMode><RefreshAssignments nextChangeAt={start + 40_000} checkedAt={start} /></StrictMode>);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    rerender(<StrictMode><RefreshAssignments nextChangeAt={start + 40_000} checkedAt={Date.now()} /></StrictMode>);
    act(() => { vi.advanceTimersByTime(10_025); });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(2);
    rerender(<RefreshAssignments nextChangeAt={Date.now() + 5_000} checkedAt={Date.now()} />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent(window, new Event("focus"));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(2);
  });

  it("shows a safe synchronous refresh failure and permits retry without claiming a confirmed update", () => {
    mocks.router.refresh.mockImplementationOnce(() => { throw new Error("private details"); });
    render(<RefreshAssignments />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not refresh assignments. Reload this page to try again.");
    expect(screen.queryByText("private details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
