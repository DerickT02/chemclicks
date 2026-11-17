/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  buildTeacherEmailRedirectTo,
  getTeacherPasswordResetMessage,
  getTeacherVerificationResentMessage,
} from "@/lib/auth/teacher-email-verification";
import {
  EMAIL_NOT_CONFIRMED_MESSAGE,
  EMAIL_RATE_LIMIT_MESSAGE,
  GENERIC_RETRY_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/errors/user-facing-errors";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  push: vi.fn(),
  params: "",
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.params),
}));

import { resendTeacherVerification } from "@/lib/auth/resend-teacher-verification";
import { ResendTeacherVerification } from "@/components/auth/ResendTeacherVerification";
import TeacherLoginPage from "@/app/login/teacher/page";
import TeacherCreateAccountPage from "@/app/create-account/teacher/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.params = "";
  mocks.resend.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.signUp.mockResolvedValue({ data: { user: { id: "teacher", identities: [{}] } }, error: null });
  mocks.createClient.mockImplementation(() => ({
    auth: {
      resend: mocks.resend,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      signUp: mocks.signUp,
      signInWithPassword: mocks.signIn,
    },
  }));
});
afterEach(cleanup);

const resendButton = () => screen.getByRole("button", { name: "Resend verification email" });
const queryResendButton = () => screen.queryByRole("button", { name: "Resend verification email" });

describe("resendTeacherVerification", () => {
  it("requests a signup link with the teacher verification callback", async () => {
    await expect(resendTeacherVerification("teacher@example.com", "https://app.test")).resolves.toEqual({ sent: true });
    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "teacher@example.com",
      options: { emailRedirectTo: buildTeacherEmailRedirectTo("https://app.test") },
    });
  });

  const failures: { name: string; arrange: () => void; error: string }[] = [
    {
      name: "a returned error",
      arrange: () => mocks.resend.mockResolvedValue({ error: { message: "private details" } }),
      error: GENERIC_RETRY_MESSAGE,
    },
    {
      name: "a thrown error",
      arrange: () => mocks.resend.mockRejectedValue(new Error("private details")),
      error: GENERIC_RETRY_MESSAGE,
    },
    {
      name: "a client configuration error",
      arrange: () => mocks.createClient.mockImplementation(() => { throw new Error("private details"); }),
      error: GENERIC_RETRY_MESSAGE,
    },
    {
      name: "a rate limit",
      arrange: () => mocks.resend.mockResolvedValue({ error: { status: 429 } }),
      error: EMAIL_RATE_LIMIT_MESSAGE,
    },
  ];

  it.each(failures)("maps $name to a user-facing message", async ({ arrange, error }) => {
    arrange();
    await expect(resendTeacherVerification("teacher@example.com", "https://app.test"))
      .resolves.toEqual({ sent: false, error });
  });
});

describe("resend on the check-your-email screen", () => {
  async function signUp() {
    render(<TeacherCreateAccountPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Display name"), "Teacher");
    await user.type(screen.getByLabelText("Email"), " teacher@example.com ");
    await user.type(screen.getByLabelText("Password", { exact: true }), "Test123!");
    await user.type(screen.getByLabelText("Confirm password"), "Test123!");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    return user;
  }

  it("resends to the normalized signup email without signing up again", async () => {
    const user = await signUp();
    await user.click(resendButton());
    expect(mocks.resend).toHaveBeenCalledWith(expect.objectContaining({ email: "teacher@example.com", type: "signup" }));
    expect(mocks.signUp).toHaveBeenCalledTimes(1);
    expect(screen.getByText(getTeacherVerificationResentMessage("teacher@example.com"))).toBeInTheDocument();
  });

  it("shows failures and allows retry", async () => {
    mocks.resend.mockResolvedValueOnce({ error: { status: 429 } });
    const user = await signUp();
    await user.click(resendButton());
    expect(screen.getByRole("alert")).toHaveTextContent(EMAIL_RATE_LIMIT_MESSAGE);
    await user.click(resendButton());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(getTeacherVerificationResentMessage("teacher@example.com"))).toBeInTheDocument();
  });

  it("disables the button while sending to prevent duplicate requests", async () => {
    let finish!: (value: { error: null }) => void;
    mocks.resend.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<ResendTeacherVerification email="teacher@example.com" />);
    const user = userEvent.setup();
    await user.click(resendButton());
    const sending = screen.getByRole("button", { name: "Sending verification email..." });
    expect(sending).toBeDisabled();
    await user.click(sending);
    expect(mocks.resend).toHaveBeenCalledTimes(1);
    await act(async () => finish({ error: null }));
    expect(resendButton()).toBeEnabled();
  });
});

describe("resend on teacher login", () => {
  it("is hidden until verification is known to be required", () => {
    render(<TeacherLoginPage />);
    expect(queryResendButton()).not.toBeInTheDocument();
  });

  it("is offered after the verification-required redirect with a single verify message", () => {
    mocks.params = "verification=required";
    render(<TeacherLoginPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(EMAIL_NOT_CONFIRMED_MESSAGE);
    expect(resendButton()).toBeEnabled();
  });

  it("is offered after sign-in fails for an unconfirmed email, without duplicating the alert", async () => {
    mocks.params = "verification=required";
    mocks.signIn.mockResolvedValue({ error: { code: "email_not_confirmed" } });
    render(<TeacherLoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "teacher@example.com");
    await user.type(screen.getByLabelText("Password"), "Test123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(EMAIL_NOT_CONFIRMED_MESSAGE);
    expect(resendButton()).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("is not offered after a wrong password", async () => {
    mocks.signIn.mockResolvedValue({ error: { code: "invalid_credentials" } });
    render(<TeacherLoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "teacher@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent(INVALID_CREDENTIALS_MESSAGE);
    expect(queryResendButton()).not.toBeInTheDocument();
  });

  it.each([
    ["", "Enter your email above to resend the verification email."],
    ["not-an-email", "Please enter a valid email address."],
  ])("shows validation for %j on the email field without calling Auth", async (email, message) => {
    mocks.params = "verification=required";
    render(<TeacherLoginPage />);
    const user = userEvent.setup();
    if (email) await user.type(screen.getByLabelText("Email"), email);
    await user.click(resendButton());
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(message);
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("sends the trimmed email without a password and replaces the verify alert with the notice", async () => {
    mocks.params = "verification=required";
    render(<TeacherLoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "  Teacher@School.edu  ");
    await user.click(resendButton());
    expect(mocks.resend).toHaveBeenCalledWith(expect.objectContaining({ email: "Teacher@School.edu" }));
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(getTeacherVerificationResentMessage("Teacher@School.edu"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(resendButton()).toBeEnabled();
  });

  it("shows resend failures in the form error slot", async () => {
    mocks.params = "verification=required";
    mocks.resend.mockResolvedValue({ error: { status: 429 } });
    render(<TeacherLoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "teacher@example.com");
    await user.click(resendButton());
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(EMAIL_RATE_LIMIT_MESSAGE);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shares one notice slot with the password reset flow", async () => {
    mocks.params = "verification=required";
    render(<TeacherLoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "teacher@example.com");
    await user.click(resendButton());
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(getTeacherPasswordResetMessage("teacher@example.com"));
  });
});
