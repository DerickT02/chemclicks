/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DATABASE_RETRY_MESSAGE, SESSION_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";

const mocks = vi.hoisted(() => ({
  loginStudent: vi.fn(), createClient: vi.fn(), signIn: vi.fn(),
  signUp: vi.fn(), teacherLookup: vi.fn(), signOut: vi.fn(), push: vi.fn(),
}));
vi.mock("@/app/login/student/actions", () => ({ loginStudent: mocks.loginStudent }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

import StudentLoginPage from "@/app/login/student/page";
import TeacherLoginPage from "@/app/login/teacher/page";
import TeacherCreateAccountPage from "@/app/create-account/teacher/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockImplementation(() => ({
    auth: { signInWithPassword: mocks.signIn, signUp: mocks.signUp, signOut: mocks.signOut },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.teacherLookup }) }) }),
  }));
  mocks.signIn.mockResolvedValue({ data: { user: { id: "teacher" } }, error: null });
  mocks.teacherLookup.mockResolvedValue({ data: { id: "teacher" }, error: null });
  mocks.signUp.mockResolvedValue({ data: { user: { id: "teacher", identities: [{}] } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(cleanup);

async function fillTeacherLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "teacher@example.com");
  await user.type(screen.getByLabelText("Password"), "Test123!");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

async function fillTeacherSignup() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Display name"), "Teacher");
  await user.type(screen.getByLabelText("Email"), "teacher@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "Test123!");
  await user.type(screen.getByLabelText("Confirm password"), "Test123!");
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("student login form", () => {
  it.each(["returned", "thrown"])("announces %s failures and allows retry without success feedback", async (failure) => {
    if (failure === "returned") mocks.loginStudent.mockResolvedValue({ ok: false, field: "form", message: SESSION_RETRY_MESSAGE });
    else mocks.loginStudent.mockRejectedValue(new Error("private failure"));
    const user = userEvent.setup();
    render(<StudentLoginPage />);
    await user.type(screen.getByLabelText("Student ID"), "DEMO1");
    await user.type(screen.getByLabelText("Classroom code"), "ABC123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(SESSION_RETRY_MESSAGE);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.loginStudent).toHaveBeenCalledTimes(2);
  });

  it("offers a direct join-class link", () => {
    render(<StudentLoginPage />);
    expect(screen.getByRole("link", { name: "Join a class" })).toHaveAttribute("href", "/create-account/student");
  });
});

describe("teacher login form", () => {
  it.each(["configuration", "sign-in", "profile lookup"])("recovers pending state after a thrown %s failure", async (failure) => {
    const error = new Error("private configuration details");
    if (failure === "configuration") mocks.createClient.mockImplementation(() => { throw error; });
    else if (failure === "sign-in") mocks.signIn.mockRejectedValue(error);
    else mocks.teacherLookup.mockRejectedValue(error);
    render(<TeacherLoginPage />);
    await fillTeacherLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent(DATABASE_RETRY_MESSAGE);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("navigates only after confirming teacher membership", async () => {
    render(<TeacherLoginPage />);
    await fillTeacherLogin();
    expect(mocks.push).toHaveBeenCalledWith("/admin");
  });

  it("offers password recovery without promising administrator approval", async () => {
    mocks.teacherLookup.mockResolvedValue({ data: null, error: null });
    render(<TeacherLoginPage />);
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeEnabled();
    await fillTeacherLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("does not have a teacher profile");
    expect(screen.getByRole("alert")).not.toHaveTextContent("administrator");
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("teacher signup form", () => {
  // The teachers row comes from a database trigger, so sign-up makes no profile insert.
  it.each(["configuration", "signup"])("recovers pending state after a thrown %s failure", async (failure) => {
    const error = new Error("private configuration details");
    if (failure === "configuration") mocks.createClient.mockImplementation(() => { throw error; });
    else mocks.signUp.mockRejectedValue(error);
    render(<TeacherCreateAccountPage />);
    await fillTeacherSignup();
    expect(await screen.findByRole("alert")).toHaveTextContent(DATABASE_RETRY_MESSAGE);
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  it("retains passwords when correcting an unrelated display-name validation error", async () => {
    const user = userEvent.setup();
    render(<TeacherCreateAccountPage />);
    await user.type(screen.getByLabelText("Email"), "teacher@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "Test123!");
    await user.type(screen.getByLabelText("Confirm password"), "Test123!");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Display name is required.");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("Test123!");
    expect(screen.getByLabelText("Confirm password")).toHaveValue("Test123!");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("retains the verification step after successful signup", async () => {
    render(<TeacherCreateAccountPage />);
    await fillTeacherSignup();
    expect(await screen.findByRole("status")).toHaveTextContent("verify your email");
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
  });
});
