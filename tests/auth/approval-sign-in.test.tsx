// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn() }));
vi.mock("@/app/login/student/actions", () => ({ loginStudent: mocks.login }));
vi.mock("@/app/create-account/student/actions", () => ({ signupStudent: mocks.signup }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import StudentLoginPage from "@/app/login/student/page";
import StudentCreateAccountPage from "@/app/create-account/student/page";
import { APPROVAL_CHECK_INTERVAL_MS } from "@/app/login/student/use-approval-sign-in";

const pending = { ok: false, field: "approval", message: "Your account is awaiting teacher approval. Keep this page open." };
const field = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const nextCheck = () => act(async () => { await vi.advanceTimersByTimeAsync(APPROVAL_CHECK_INTERVAL_MS); });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  mocks.signup.mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function submitLogin() {
  render(<StudentLoginPage />);
  field("Student ID", " demo1 "); field("Classroom code", "abc123");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });
}

describe("waiting for teacher approval", () => {
  it("keeps checking from the login page and signs in once the teacher approves", async () => {
    mocks.login.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValueOnce({ ok: true });
    await submitLogin();
    expect(screen.getByRole("alert")).toHaveTextContent("awaiting teacher approval");
    await nextCheck();
    expect(mocks.login).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await nextCheck();
    expect(mocks.login).toHaveBeenLastCalledWith("demo1", "ABC123");
    expect(screen.getByRole("status")).toHaveTextContent("Opening your assignments");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await nextCheck();
    expect(mocks.login).toHaveBeenCalledTimes(3);
  });

  it("does not check for other login errors, and stops when the student edits their details", async () => {
    mocks.login.mockResolvedValueOnce({ ok: false, field: "form", message: "Please try again." });
    await submitLogin();
    await nextCheck();
    expect(mocks.login).toHaveBeenCalledTimes(1);

    mocks.login.mockResolvedValue(pending);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });
    field("Student ID", "OTHER1");
    await nextCheck();
    expect(mocks.login).toHaveBeenCalledTimes(2);
  });

  it("keeps checking through transient failures and stops if the account is gone", async () => {
    mocks.login.mockResolvedValueOnce(pending).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: false, field: "studentID", message: "Student ID not found." });
    await submitLogin();
    await nextCheck();
    await nextCheck();
    await nextCheck();
    expect(mocks.login).toHaveBeenCalledTimes(3);
  });

  it("signs a newly joined student in from the confirmation page once approved", async () => {
    mocks.login.mockResolvedValueOnce(pending).mockResolvedValueOnce({ ok: true });
    render(<StudentCreateAccountPage />);
    field("First Name", "Alex"); field("Last Name", "Student"); field("Student ID", "DEMO1"); field("Classroom code", "abc123");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Join class" })); });
    expect(screen.getByRole("status")).toHaveTextContent("awaiting teacher approval");
    expect(mocks.login).not.toHaveBeenCalled();
    await nextCheck();
    expect(screen.getByRole("status")).toHaveTextContent("awaiting teacher approval");
    await nextCheck();
    expect(mocks.login).toHaveBeenLastCalledWith("DEMO1", "ABC123");
    expect(screen.getByRole("status")).toHaveTextContent("Your teacher approved your account");
  });
});
