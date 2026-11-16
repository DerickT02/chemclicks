/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  buildTeacherEmailRedirectTo,
  getTeacherVerificationResentMessage,
} from "@/lib/auth/teacher-email-verification";
import { EMAIL_RATE_LIMIT_MESSAGE, GENERIC_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resend: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));

import { resendTeacherVerification } from "@/lib/auth/resend-teacher-verification";
import { ResendTeacherVerification } from "@/components/auth/ResendTeacherVerification";
import TeacherCreateAccountPage from "@/app/create-account/teacher/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resend.mockResolvedValue({ error: null });
  mocks.signUp.mockResolvedValue({ data: { user: { id: "teacher", identities: [{}] } }, error: null });
  mocks.createClient.mockImplementation(() => ({
    auth: { resend: mocks.resend, signUp: mocks.signUp },
  }));
});
afterEach(cleanup);

const resendButton = () => screen.getByRole("button", { name: "Resend verification email" });

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
