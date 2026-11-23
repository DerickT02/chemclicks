// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityProgressView } from "@/app/admin/classes/[classId]/activities/[assignmentId]/ActivityProgressView";
import type { TeacherActivityAttemptSummary } from "@/lib/server/teacher-attempts";
import { progressFacts } from "../testing/progress";

const mocks = vi.hoisted(() => ({ push: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("@/lib/teacher-class-updates", () => ({ subscribeTeacherClass: mocks.subscribe }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRouter: () => ({ push: mocks.push }),
    usePathname: () => useSyncExternalStore(callback => {
      window.addEventListener("popstate", callback);
      window.addEventListener("test:history", callback);
      return () => {
        window.removeEventListener("popstate", callback);
        window.removeEventListener("test:history", callback);
      };
    }, () => window.location.pathname),
  };
});

const assignments = [
  { id: "lewis", title: "Lewis diagrams" },
  { id: "ruler", title: "Ruler" },
  { id: "bohr", title: "Bohr Models" },
];
const initialSummary: TeacherActivityAttemptSummary = {
  classId: "class", className: "Chemistry", assignmentId: "lewis", activityId: "activity", activityTitle: "Lewis diagrams",
  students: [{
    studentId: "mina", firstName: "Mina", lastName: "Chen", verified: true,
    attemptCount: 0, completedCount: 0, inProgressCount: 0, explorationAttemptCount: 0, quizAttemptCount: 0,
    quizStartedAt: null, progress: progressFacts(), attempts: [],
  }],
};
const rulerSummary: TeacherActivityAttemptSummary = {
  ...initialSummary, assignmentId: "ruler", activityTitle: "Ruler",
  students: [{ ...initialSummary.students[0], progress: progressFacts({ stage: "completed" }) }],
};
const reply = (attempts: TeacherActivityAttemptSummary) => ({
  ok: true, redirected: false,
  json: async () => ({ classId: attempts.classId, revision: "1", reset: true, removedStudentIds: [], roster: null, progress: null, attempts }),
});
const fetchMock = vi.fn();
const selectLesson = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(screen.getByRole("combobox", { name: "Lesson" }));
  await user.click(screen.getByRole("option", { name: title }));
};

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/admin/classes/class/activities/lewis");
  const pushState = window.history.pushState.bind(window.history);
  // Next patches native history to notify usePathname without requesting a page.
  vi.spyOn(window.history, "pushState").mockImplementation((...args) => {
    pushState(...args);
    window.dispatchEvent(new Event("test:history"));
  });
  mocks.subscribe.mockReturnValue(mocks.unsubscribe);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(reply(rulerSummary));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ActivityProgressView", () => {
  it("loads only the selected lesson data in place, preserving the search and controls", async () => {
    let finish!: (response: ReturnType<typeof reply>) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup();
    render(<ActivityProgressView initialSummary={initialSummary} assignments={assignments} />);
    expect(fetchMock).not.toHaveBeenCalled();
    const dropdown = screen.getByRole("combobox", { name: "Lesson" });
    const search = screen.getByRole("searchbox", { name: "Search students" });
    await user.type(search, "Mina");
    await selectLesson(user, "Ruler");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/admin/classes/class/activities/ruler");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/admin/classes/class/updates?assignmentId=ruler", expect.objectContaining({ cache: "no-store", credentials: "same-origin" }));
    const loading = screen.getByRole("status", { name: "Loading student progress" });
    expect(loading.textContent).toBe("");
    expect(loading.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(loading.querySelectorAll(".animate-spin")).toHaveLength(2);
    expect(loading.parentElement).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/interrupted/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Student progress for Lewis diagrams" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Lesson" })).toBe(dropdown);
    expect(screen.getByRole("searchbox", { name: "Search students" })).toBe(search);
    expect(search).toHaveValue("Mina");
    await act(async () => { finish(reply(rulerSummary)); });
    expect(screen.getByRole("region", { name: "Student progress for Ruler" })).toBeInTheDocument();
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading student progress" })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1 students")).toBeInTheDocument();
    expect(document.title).toBe("Ruler · Student progress | ChemClicks");
  });

  it("aborts obsolete reads and ignores late responses when lessons change quickly", async () => {
    let finish!: (response: ReturnType<typeof reply>) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup();
    render(<ActivityProgressView initialSummary={initialSummary} assignments={assignments} />);
    await selectLesson(user, "Ruler");
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    fetchMock.mockResolvedValue(reply({ ...initialSummary, assignmentId: "bohr", activityTitle: "Bohr Models" }));
    await selectLesson(user, "Bohr Models");
    expect(signal.aborted).toBe(true);
    await screen.findByRole("region", { name: "Student progress for Bohr Models" });
    await act(async () => { finish(reply(rulerSummary)); });
    expect(screen.getByRole("region", { name: "Student progress for Bohr Models" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Student progress for Ruler" })).not.toBeInTheDocument();
    expect(screen.getByText("0 of 1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a failed lesson read inline and allows switching to another lesson", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<ActivityProgressView initialSummary={initialSummary} assignments={assignments} />);
    const search = screen.getByRole("searchbox", { name: "Search students" });
    await user.type(search, "Chen");
    await selectLesson(user, "Ruler");
    expect(await screen.findByText("Student progress could not be loaded. Retrying automatically.")).toBeInTheDocument();
    expect(search).toHaveValue("Chen");
    expect(screen.queryByText("No students enrolled yet.")).not.toBeInTheDocument();
    await selectLesson(user, "Lewis diagrams");
    expect(screen.getByRole("region", { name: "Student progress for Lewis diagrams" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search students" })).toBe(search);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("restores the selected lesson through browser Back and Forward without resetting search", async () => {
    const user = userEvent.setup();
    render(<ActivityProgressView initialSummary={initialSummary} assignments={assignments} />);
    const search = screen.getByRole("searchbox", { name: "Search students" });
    await user.type(search, "Mina");
    await selectLesson(user, "Ruler");
    await screen.findByRole("region", { name: "Student progress for Ruler" });
    act(() => { window.history.back(); });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Lesson" })).toHaveTextContent("Lewis diagrams"));
    expect(screen.getByRole("region", { name: "Student progress for Lewis diagrams" })).toBeInTheDocument();
    expect(search).toHaveValue("Mina");
    expect(document.title).toBe("Lewis diagrams · Student progress | ChemClicks");
    act(() => { window.history.forward(); });
    await screen.findByRole("region", { name: "Student progress for Ruler" });
    expect(screen.getByRole("combobox", { name: "Lesson" })).toHaveTextContent("Ruler");
    expect(screen.getByRole("searchbox", { name: "Search students" })).toBe(search);
    expect(search).toHaveValue("Mina");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("still navigates to the class activity list for See all", async () => {
    const user = userEvent.setup();
    render(<ActivityProgressView initialSummary={initialSummary} assignments={assignments} />);
    await selectLesson(user, "See all");
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/admin?classId=class#class-activities");
    expect(window.history.pushState).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("encodes route identifiers when changing lessons or opening the activity list", async () => {
    const user = userEvent.setup();
    render(<ActivityProgressView initialSummary={{ ...initialSummary, classId: "class/?" }} assignments={[...assignments, { id: "lesson/?", title: "Another lesson" }]} />);
    await selectLesson(user, "Another lesson");
    expect(window.location.pathname).toBe("/admin/classes/class%2F%3F/activities/lesson%2F%3F");
    expect(fetchMock.mock.calls[0][0]).toBe("/admin/classes/class%2F%3F/updates?assignmentId=lesson%2F%3F");
    await selectLesson(user, "See all");
    expect(mocks.push).toHaveBeenCalledWith("/admin?classId=class%2F%3F#class-activities");
  });
});
