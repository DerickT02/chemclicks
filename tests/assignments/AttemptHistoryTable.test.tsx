// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptHistoryTable } from "@/app/admin/classes/[classId]/activities/[assignmentId]/AttemptHistoryTable";
import { LazyAttemptHistory } from "@/app/admin/classes/[classId]/activities/[assignmentId]/LazyAttemptHistory";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";
import { progressFacts } from "../testing/progress";

const { liveProgress } = vi.hoisted(() => ({ liveProgress: vi.fn() }));
vi.mock("@/components/assignments/useLiveTeacherProgress", () => ({ useLiveTeacherProgress: liveProgress }));

const student: TeacherActivityAttemptSummary["students"][number] = {
  studentId: "mina", firstName: "Mina", lastName: "Chen", verified: true,
  attemptCount: 2, completedCount: 1, inProgressCount: 1, explorationAttemptCount: 1, quizAttemptCount: 1,
  quizStartedAt: null, progress: progressFacts(),
  attempts: [
    { id: "newer", attemptNumber: 2, status: "in_progress", kind: "exploration", quizKey: null, startedAt: "2026-09-24T12:00:00Z", completedAt: null },
    { id: "older", attemptNumber: 1, status: "completed", kind: "quiz", quizKey: "measurement_ruler_tenths", instrument: "ruler", precisionMode: "tenths", score: 4, questionTotal: 5, passed: true, startedAt: "2026-09-23T12:00:00Z", completedAt: "2026-09-23T12:05:00Z" },
  ],
};

beforeEach(() => {
  liveProgress.mockReset();
  liveProgress.mockImplementation((_url: string, _initial: unknown, options: { enabled?: boolean }) => ({
    status: options.enabled ? "ready" : "loading",
    data: options.enabled ? student.attempts : null,
    failed: false,
  }));
});
afterEach(cleanup);

describe("AttemptHistoryTable", () => {
  it("uses the shared table styling and preserves attempt order, labels, scores, and timestamps", () => {
    render(<AttemptHistoryTable firstName="Mina" lastName="Chen" attempts={student.attempts} />);
    const table = screen.getByRole("table", { name: "Attempt history for Mina Chen, newest first" });
    expect(table.parentElement).toHaveClass("rounded-xl", "border", "border-border", "bg-card", "shadow-sm", "overflow-x-auto");
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Attempt", "Activity", "Status", "Started", "Completed"]);
    expect(within(table).getAllByRole("rowheader").map(header => header.textContent)).toEqual(["2", "1"]);
    expect(within(table).getByText("Exploration")).toBeInTheDocument();
    expect(within(table).getByText("Ruler · tenths (0.1 cm)")).toBeInTheDocument();
    expect(within(table).getByText("4/5 · Passed")).toBeInTheDocument();
    expect(within(table).getByText("Not completed")).toBeInTheDocument();
    expect(table.querySelector('time[datetime="2026-09-23T12:05:00Z"]')).toBeInTheDocument();
    expect(table).not.toHaveTextContent("measurement_ruler_tenths");
  });

  it("preserves a zero score and a failed result", () => {
    render(<AttemptHistoryTable firstName="Mina" lastName="Chen" attempts={[{ ...student.attempts[1], score: 0, passed: false }]} />);
    expect(screen.getByText("0/5 · Not passed")).toBeInTheDocument();
  });

  it("shows the shared atom animation while history loads, then replaces it with the table", async () => {
    const user = userEvent.setup();
    liveProgress.mockReturnValue({ status: "loading", data: null, failed: false });
    const { rerender } = render(<LazyAttemptHistory classId="class" assignmentId="lesson" student={student} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByText("Attempt history (2)"));
    const loading = await screen.findByRole("status");
    expect(loading).toHaveTextContent("Loading attempt history…");
    expect(loading).toHaveAttribute("aria-live", "polite");
    expect(loading.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(loading.querySelectorAll("g.animate-spin")).toHaveLength(2);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    liveProgress.mockReturnValue({ status: "ready", data: student.attempts, failed: false });
    rerender(<LazyAttemptHistory classId="class" assignmentId="lesson" student={student} />);
    expect(screen.queryByText("Loading attempt history…")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("hides the loading animation when history is closed before the request finishes", async () => {
    const user = userEvent.setup();
    liveProgress.mockReturnValue({ status: "loading", data: null, failed: false });
    render(<LazyAttemptHistory classId="class" assignmentId="lesson" student={student} />);
    const disclosure = screen.getByText("Attempt history (2)");
    await user.click(disclosure);
    expect(await screen.findByRole("status")).toHaveTextContent("Loading attempt history…");
    await user.click(disclosure);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("replaces the loading animation with an error message when a read fails", async () => {
    const user = userEvent.setup();
    liveProgress.mockReturnValue({ status: "loading", data: null, failed: false });
    const { rerender } = render(<LazyAttemptHistory classId="class" assignmentId="lesson" student={student} />);
    await user.click(screen.getByText("Attempt history (2)"));
    expect(await screen.findByRole("status")).toHaveTextContent("Loading attempt history…");
    liveProgress.mockReturnValue({ status: "unavailable", data: null, failed: true });
    rerender(<LazyAttemptHistory classId="class" assignmentId="lesson" student={student} />);
    expect(screen.getByRole("status")).toHaveTextContent("Attempt history could not be loaded. Retrying automatically.");
    expect(screen.getByRole("status").querySelector("svg")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading attempt history…")).not.toBeInTheDocument();
  });

  it("only shows the styled table when history is expanded", async () => {
    const user = userEvent.setup();
    render(<LazyAttemptHistory classId="class" assignmentId="lesson" student={student} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const disclosure = screen.getByText("Attempt history (2)");
    await user.click(disclosure);
    const table = await screen.findByRole("table", { name: "Attempt history for Mina Chen, newest first" });
    expect(table.parentElement).toHaveClass("rounded-xl", "border-border", "shadow-sm");
    expect(liveProgress).toHaveBeenLastCalledWith("/admin/classes/class/attempt-history?assignmentId=lesson&studentId=mina", null, { classId: "class", assignmentId: "lesson", enabled: true });
    await user.click(disclosure);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(liveProgress).toHaveBeenLastCalledWith("/admin/classes/class/attempt-history?assignmentId=lesson&studentId=mina", null, { classId: "class", assignmentId: "lesson", enabled: false });
  });
});
