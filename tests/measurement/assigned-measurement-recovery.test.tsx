// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describeDecimalPlaces } from "@/lib/measurement/instruments";
import { getMeasurementQuizMode, type MeasurementQuizModeKey } from "@/lib/measurement/modes";
import {
  COMPLETE_RPC,
  RECORD_RPC,
  START_RPC,
  createFakeMeasurementRpc,
  type FakeMeasurementRpc,
} from "./helpers/fake-measurement-rpc";

const ASSIGNMENT_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const CLASS_ID = "33333333-3333-4333-8333-333333333333";

const backend = vi.hoisted(() => ({
  fake: null as null | { rpc: (name: string, params: Record<string, unknown>) => Promise<unknown> },
  session: null as null | { studentId: string; classId: string },
}));

// Only the outside world is replaced. The real server actions, server boundary,
// reducer and component run against the stateful RPC double.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/student-session", () => ({
  getStudentSession: async () => backend.session,
}));
vi.mock("@/lib/server/database", () => ({
  createServiceClient: () => ({
    rpc: (name: string, params: Record<string, unknown>) => backend.fake!.rpc(name, params),
  }),
}));
vi.mock("@/lib/assignments/prerequisites", () => ({
  getQuizProgression: async () => ({ passed: false, nextDestination: null }),
}));

import MeasurementQuiz from "@/components/measurement/MeasurementQuiz";

const MODES: MeasurementQuizModeKey[] = [
  "ruler_tenths",
  "ruler_hundredths",
  "cylinder_whole",
  "cylinder_tenths",
];

afterEach(cleanup);

describe.each(MODES)("assigned %s quiz recovery", (mode) => {
  const { spec } = getMeasurementQuizMode(mode);
  const label = `Your reading, in ${spec.unitName}`;
  const reportTo = `the nearest ${spec.step} ${spec.unit} (${describeDecimalPlaces(spec.decimals)})`;
  let fake: FakeMeasurementRpc;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    fake = createFakeMeasurementRpc({
      studentId: STUDENT_ID, classId: CLASS_ID, assignmentId: ASSIGNMENT_ID, mode,
    });
    backend.fake = fake;
    backend.session = { studentId: STUDENT_ID, classId: CLASS_ID };
    user = userEvent.setup();
  });

  function renderQuiz() {
    return render(<MeasurementQuiz assignmentId={ASSIGNMENT_ID} mode={mode} />);
  }

  function session() {
    expect(fake.sessions).toHaveLength(1);
    return fake.sessions[0];
  }

  function correctAnswer(index: number) {
    return session().questions[index].reading.toFixed(spec.decimals);
  }

  function wrongAnswer(index: number) {
    const reading = session().questions[index].reading;
    const shift = spec.max / 3;
    return (reading > spec.max / 2 ? reading - shift : reading + shift).toFixed(spec.decimals);
  }

  function expectQuestion(number: number) {
    expect(screen.getByRole("heading", { name: `${spec.name} question ${number} of 5` })).toBeTruthy();
    expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByText(reportTo)).toBeTruthy();
  }

  function feedback() {
    return screen.getByRole("status");
  }

  async function startQuiz() {
    await user.click(screen.getByRole("button", { name: "Start quiz" }));
    await screen.findByRole("heading", { name: new RegExp(`^${spec.name} question \\d of 5$`) });
  }

  async function typeAnswer(value: string) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    await user.type(input, value);
  }

  /** Submits an answer and waits for it to be graded and locked. */
  async function answer(value: string) {
    await typeAnswer(value);
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await screen.findByRole("button", { name: /^(Next question|See results)$/ });
  }

  async function next() {
    await user.click(screen.getByRole("button", { name: "Next question" }));
  }

  async function expectAlert(message: string) {
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  }

  it("recovers from a rejected or thrown start without inventing an attempt", async () => {
    fake.failNext(START_RPC, "error");
    fake.failNext(START_RPC, "throw");
    renderQuiz();

    await user.click(screen.getByRole("button", { name: "Start quiz" }));
    await expectAlert("The quiz could not be started. Please try again.");
    expect(screen.getByRole("button", { name: "Start quiz" })).toBeEnabled();
    expect(screen.queryByLabelText(label)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Start quiz" }));
    await waitFor(() => expect(fake.callsTo(START_RPC)).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start quiz" })).toBeEnabled());
    expect(screen.getByRole("alert")).toHaveTextContent("could not be started");
    expect(fake.sessions).toHaveLength(0);

    await startQuiz();
    expectQuestion(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(session().attemptNumber).toBe(1);
  });

  it("keeps the typed answer after a failed save and grades the retry once", async () => {
    renderQuiz();
    await startQuiz();
    const input = screen.getByLabelText(label);
    const value = correctAnswer(0);

    for (const fault of ["error", "throw"] as const) {
      fake.failNext(RECORD_RPC, fault);
      await typeAnswer(value);
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await expectAlert("Your answer could not be saved. Please try again.");
      await waitFor(() => expect(screen.getByRole("button", { name: "Check answer" })).toBeEnabled());
      expect(input).toHaveValue(value);
      expect(input).not.toHaveAttribute("readonly");
      expect(feedback()).toBeEmptyDOMElement();
      expect(screen.queryByRole("button", { name: "Next question" })).toBeNull();
      expect(session().questions[0].firstAnswer).toBeNull();
    }

    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await screen.findByRole("button", { name: "Next question" });
    expect(feedback()).toHaveTextContent("Correct");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(session().questions[0]).toMatchObject({ firstAnswer: value, isCorrect: true });
    expect(fake.callsTo(RECORD_RPC)).toHaveLength(3);
    expectQuestion(1);
  });

  it("keeps the first saved answer when a lost save is retried with a changed answer", async () => {
    renderQuiz();
    await startQuiz();
    const firstAnswer = wrongAnswer(0);

    fake.failNext(RECORD_RPC, "lose");
    await typeAnswer(firstAnswer);
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await expectAlert("Your answer could not be saved. Please try again.");
    expect(session().questions[0]).toMatchObject({ firstAnswer, isCorrect: false });

    await answer(correctAnswer(0));
    expect(feedback()).toHaveTextContent("Incorrect");
    expect(feedback()).toHaveTextContent("Your first answer was already saved");
    expect(feedback()).not.toHaveTextContent(/^✓/);
    expect(session().questions[0]).toMatchObject({ firstAnswer, isCorrect: false });

    for (let index = 1; index < 5; index += 1) {
      await next();
      await answer(correctAnswer(index));
    }
    await user.click(screen.getByRole("button", { name: "See results" }));
    await screen.findByRole("heading", { name: `${spec.name} results: 4 of 5 correct` });
    expect(fake.results).toEqual([expect.objectContaining({ score: 4, attempt_number: 1 })]);
  });

  it("returns the one saved result when a lost or rejected completion is retried", async () => {
    renderQuiz();
    await startQuiz();
    for (let index = 0; index < 5; index += 1) {
      if (index > 0) await next();
      await answer(correctAnswer(index));
    }

    fake.failNext(COMPLETE_RPC, "error");
    fake.failNext(COMPLETE_RPC, "lose");
    for (let failure = 1; failure <= 2; failure += 1) {
      await user.click(screen.getByRole("button", { name: "See results" }));
      await waitFor(() => expect(fake.callsTo(COMPLETE_RPC)).toHaveLength(failure));
      await expectAlert("The quiz could not be completed. Please try again.");
      await waitFor(() => expect(screen.getByRole("button", { name: "See results" }))
        .not.toHaveAttribute("aria-disabled"));
      expectQuestion(5);
      expect(screen.queryByRole("heading", { name: /results/ })).toBeNull();
    }
    expect(fake.results).toHaveLength(1);
    const saved = fake.results[0];

    await user.click(screen.getByRole("button", { name: "See results" }));
    await screen.findByRole("heading", { name: `${spec.name} results: 5 of 5 correct` });
    expect(screen.getByText("Attempt 1")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fake.results).toEqual([saved]);
    expect(session()).toMatchObject({ status: "completed", resultId: saved.id });
  });

  it("resumes an unfinished attempt after a remount instead of resetting it", async () => {
    const first = renderQuiz();
    await startQuiz();
    await answer(correctAnswer(0));
    await next();
    await answer(wrongAnswer(1));
    await next();
    first.unmount();

    renderQuiz();
    await startQuiz();
    expectQuestion(3);
    expect(screen.getByLabelText(label)).toHaveValue("");
    expect(fake.sessions).toHaveLength(1);
    expect(session().questions.map((q) => q.isCorrect)).toEqual([true, false, null, null, null]);

    for (let index = 2; index < 5; index += 1) {
      if (index > 2) await next();
      await answer(correctAnswer(index));
    }
    await user.click(screen.getByRole("button", { name: "See results" }));
    await screen.findByRole("heading", { name: `${spec.name} results: 4 of 5 correct` });
    expect(screen.getByText("Attempt 1")).toBeTruthy();
    expect(fake.results).toEqual([expect.objectContaining({ attempt_number: 1, score: 4 })]);
  });

  it("shows the last saved answer locked when every question was answered before a remount", async () => {
    const first = renderQuiz();
    await startQuiz();
    for (let index = 0; index < 5; index += 1) {
      if (index > 0) await next();
      await answer(correctAnswer(index));
    }
    first.unmount();

    renderQuiz();
    await startQuiz();
    expectQuestion(5);
    const input = screen.getByLabelText(label);
    expect(input).toHaveValue(correctAnswer(4));
    expect(input).toHaveAttribute("readonly");
    expect(feedback()).toHaveTextContent("Correct");
    expect(screen.queryByRole("button", { name: "Check answer" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "See results" }));
    await screen.findByRole("heading", { name: `${spec.name} results: 5 of 5 correct` });
    expect(screen.getByText("Attempt 1")).toBeTruthy();
    expect(fake.callsTo(RECORD_RPC)).toHaveLength(5);
  });

  it("lets a save delayed past a remount keep first-answer scoring, and the client agrees", async () => {
    const first = renderQuiz();
    await startQuiz();
    const delayed = fake.deferNext(RECORD_RPC);
    const firstAnswer = wrongAnswer(0);
    await typeAnswer(firstAnswer);
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    first.unmount();

    renderQuiz();
    await startQuiz();
    expectQuestion(1);
    delayed.release();
    await waitFor(() => expect(session().questions[0].firstAnswer).toBe(firstAnswer));

    await answer(correctAnswer(0));
    expect(feedback()).toHaveTextContent("Incorrect");
    expect(feedback()).toHaveTextContent("Your first answer was already saved");
    expect(session().questions[0]).toMatchObject({ firstAnswer, isCorrect: false });
  });

  it("sends one request per action for rapid repeated clicks and keeps the newest state", async () => {
    renderQuiz();

    const starting = fake.deferNext(START_RPC);
    const start = screen.getByRole("button", { name: "Start quiz" });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(start).toBeDisabled();
    starting.release();
    await screen.findByRole("heading", { name: `${spec.name} question 1 of 5` });
    expect(fake.callsTo(START_RPC)).toHaveLength(1);

    const saving = fake.deferNext(RECORD_RPC);
    await typeAnswer(correctAnswer(0));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    fireEvent.submit(screen.getByLabelText(label).closest("form")!);
    expect(screen.getByRole("button", { name: "Check answer" })).toBeDisabled();
    saving.release();
    await screen.findByRole("button", { name: "Next question" });
    expect(fake.callsTo(RECORD_RPC)).toHaveLength(1);

    // Moving on twice must not skip a question.
    const nextButton = screen.getByRole("button", { name: "Next question" });
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    expectQuestion(2);

    for (let index = 1; index < 5; index += 1) {
      if (index > 1) await next();
      await answer(correctAnswer(index));
    }

    const completing = fake.deferNext(COMPLETE_RPC);
    const seeResults = screen.getByRole("button", { name: "See results" });
    fireEvent.click(seeResults);
    fireEvent.click(seeResults);
    expect(seeResults).toHaveAttribute("aria-disabled", "true");
    expect(seeResults).toHaveFocus();
    completing.release();
    await screen.findByRole("heading", { name: `${spec.name} results: 5 of 5 correct` });
    expect(fake.callsTo(COMPLETE_RPC)).toHaveLength(1);
    expect(fake.results).toHaveLength(1);

    const restarting = fake.deferNext(START_RPC);
    const tryAgain = screen.getByRole("button", { name: "Try again with new questions" });
    fireEvent.click(tryAgain);
    fireEvent.click(tryAgain);
    expect(tryAgain).toHaveAttribute("aria-disabled", "true");
    restarting.release();
    await screen.findByRole("heading", { name: `${spec.name} question 1 of 5` });
    expect(fake.callsTo(START_RPC)).toHaveLength(2);
    expect(fake.sessions.map((s) => s.attemptNumber)).toEqual([1, 2]);
    expect(screen.getByLabelText(label)).toHaveValue("");
  });
});
