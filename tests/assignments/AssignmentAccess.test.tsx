/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// Isolate our deadline timers from Next Link's idle prefetch scheduling.
vi.mock("next/link", () => ({ default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => <a href={href} className={className}>{children}</a> }));
const router = { refresh: mocks.refresh };
import AssignmentAccess from "@/components/assignments/AssignmentAccess";
import RandomizedQuiz from "@/components/quiz/RandomizedQuiz";
import type { QuizQuestion } from "@/components/quiz/types";

const NOW = Date.parse("2030-01-01T12:00:00Z");
const iso = (offset: number) => new Date(NOW + offset).toISOString();
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); mocks.refresh.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const advance = async (milliseconds: number) => act(async () => { vi.advanceTimersByTime(milliseconds); });

const questions: QuizQuestion[] = [
  { id: "q1", question: "First question?", options: ["First right", "First wrong"], correctIndex: 0 },
  { id: "q2", question: "Second question?", options: ["Second right", "Second wrong"], correctIndex: 0 },
];

describe("assignment revalidation and deadline UX", () => {
  it("refreshes on timer/focus without a deadline and cleans up on unmount", async () => {
    const view = render(<AssignmentAccess closesAt={null}><p>Exercise</p></AssignmentAccess>);
    expect(screen.getByText("Exercise")).toBeInTheDocument();
    await advance(30_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event("focus"));
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    await advance(60_000);
    fireEvent(window, new Event("focus"));
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });
  it("shows an exact deadline and closes at the exclusive boundary with honest quiz save status", async () => {
    const closesAt = iso(10_000);
    const submit = vi.fn();
    render(<AssignmentAccess closesAt={closesAt} contentType="quiz"><button onClick={submit}>Submit answer</button></AssignmentAccess>);
    expect(screen.getByText("2030-01-01 12:00:10 UTC")).toHaveAttribute("datetime", closesAt);
    expect(screen.getByText(/No further work can be submitted/)).toBeInTheDocument();
    await advance(9_999);
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeInTheDocument();
    await advance(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("This quiz is closed");
    expect(screen.getByRole("status")).toHaveTextContent("not saved or visible to your teacher");
    expect(screen.getByRole("link", { name: "Return to assignments" })).toHaveAttribute("href", "/student");
    expect(submit).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it.each([iso(-1), iso(0), "not-a-date", ""])("blocks expired or invalid deadlines on client mount (%s)", closesAt => {
    render(<AssignmentAccess closesAt={closesAt}><button>Finish exploration</button></AssignmentAccess>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Previously saved exploration attempts are retained");
    expect(screen.getByRole("status")).toHaveTextContent("unconfirmed save");
    expect(vi.getTimerCount()).toBe(1); // Revalidation interval only, no invalid-date timeout loop.
  });
  it("extends a deadline without a stale old timer closing the work", async () => {
    const view = render(<AssignmentAccess closesAt={iso(10_000)}><p>Exercise</p></AssignmentAccess>);
    await advance(5_000);
    view.rerender(<AssignmentAccess closesAt={iso(20_000)}><p>Exercise</p></AssignmentAccess>);
    await advance(5_000);
    expect(screen.getByText("Exercise")).toBeInTheDocument();
    await advance(10_000);
    expect(screen.queryByText("Exercise")).not.toBeInTheDocument();
  });
  it("honors shortened, removed, and reopened deadline metadata without a sticky closed flag", async () => {
    const view = render(<AssignmentAccess closesAt={iso(60_000)}><p>Exercise</p></AssignmentAccess>);
    view.rerender(<AssignmentAccess closesAt={iso(1_000)}><p>Exercise</p></AssignmentAccess>);
    await advance(1_000);
    expect(screen.queryByText("Exercise")).not.toBeInTheDocument();
    view.rerender(<AssignmentAccess closesAt={iso(20_000)}><p>Exercise</p></AssignmentAccess>);
    expect(screen.getByText("Exercise")).toBeInTheDocument();
    view.rerender(<AssignmentAccess closesAt={null}><p>Exercise</p></AssignmentAccess>);
    await advance(60_000);
    expect(screen.getByText("Exercise")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
  });
  it("rechecks the clock on focus after browser suspension without accumulating timeouts", () => {
    render(<AssignmentAccess closesAt={iso(60_000)}><p>Exercise</p></AssignmentAccess>);
    for (let i = 0; i < 5; i += 1) fireEvent(window, new Event("focus"));
    expect(vi.getTimerCount()).toBe(2); // One deadline timeout and one revalidation interval.
    vi.setSystemTime(NOW + 60_000);
    fireEvent(window, new Event("focus"));
    expect(screen.queryByText("Exercise")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
  it("clamps long deadlines to the browser timer limit and rechecks rather than closing early", async () => {
    const max = 2_147_483_647;
    const timeout = vi.spyOn(globalThis, "setTimeout");
    render(<AssignmentAccess closesAt={iso(max + 10_000)}><p>Exercise</p></AssignmentAccess>);
    expect(timeout.mock.calls.some(([, delay]) => delay === max)).toBe(true);
    vi.setSystemTime(NOW + max);
    fireEvent(window, new Event("focus"));
    expect(screen.getByText("Exercise")).toBeInTheDocument();
    await advance(10_000);
    expect(screen.queryByText("Exercise")).not.toBeInTheDocument();
  });
  it("preserves a real quiz through timer/focus refreshes and date edits, then stops local answers at closing", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const onComplete = vi.fn();
    let closesAt: string | null = iso(120_000);
    let currentPool = questions;
    const element = () => <AssignmentAccess key="assignment" closesAt={closesAt} contentType="quiz">
      <RandomizedQuiz title="Quiz" pool={currentPool} questionsPerAttempt={2} onComplete={onComplete} />
    </AssignmentAccess>;
    const view = render(element());
    mocks.refresh.mockImplementation(() => {
      currentPool = questions.map(q => ({ ...q, options: [...q.options] }));
      view.rerender(element());
    });
    await advance(0);
    fireEvent.click(screen.getByRole("radio", { name: "First right" }));
    await advance(30_000);
    expect(screen.getByRole("radio", { name: "First right" })).toBeChecked();
    closesAt = null;
    view.rerender(element());
    expect(screen.getByRole("radio", { name: "First right" })).toBeChecked();
    closesAt = iso(120_000);
    view.rerender(element());
    expect(screen.getByRole("radio", { name: "First right" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    closesAt = iso(150_000);
    fireEvent(window, new Event("focus"));
    expect(screen.getByRole("status")).toHaveTextContent("Correct!");
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("Second question?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Second right" }));
    await advance(90_000); // Original deadline; edited deadline is still in the future.
    expect(screen.getByRole("radio", { name: "Second right" })).toBeChecked();
    expect(onComplete).not.toHaveBeenCalled();
    await advance(30_000);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Quiz answers and results are not saved");
    expect(onComplete).not.toHaveBeenCalled();
  });
});
