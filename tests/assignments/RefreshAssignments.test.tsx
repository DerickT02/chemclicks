// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { StrictMode } from "react";
const mocks = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
import RefreshAssignments from "@/components/assignments/RefreshAssignments";

beforeEach(() => { vi.useFakeTimers(); mocks.router.refresh.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("simple dashboard refresh", () => {
  it("renders on the server, refreshes manually/on focus, and does not poll", () => {
    expect(renderToString(<RefreshAssignments />)).toContain("Refresh assignments");
    render(<RefreshAssignments />);
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(3_600_000); });
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh assignments" }));
    fireEvent(window, new Event("focus"));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("supports a classroom label and cleans up focus listeners in StrictMode", () => {
    const view = render(<StrictMode><RefreshAssignments label="Refresh classroom" /></StrictMode>);
    expect(screen.getByRole("button", { name: "Refresh classroom" })).toBeInTheDocument();
    fireEvent(window, new Event("focus"));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    view.unmount();
    fireEvent(window, new Event("focus"));
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
