/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  buildTeacherPasswordResetRedirectTo,
  getTeacherPasswordResetMessage,
  TEACHER_RESET_PASSWORD_PATH,
} from "@/lib/auth/teacher-email-verification";
import { GENERIC_RETRY_MESSAGE } from "@/lib/errors/user-facing-errors";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

import TeacherLoginPage from "@/app/login/teacher/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.createClient.mockImplementation(() => ({
    auth: {
      signInWithPassword: mocks.signIn,
      signOut: mocks.signOut,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "t" }, error: null }) }) }),
    }),
  }));
});

afterEach(cleanup);

async function clickForgotPassword() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Forgot password?" }));
  return user;
}

describe("teacher password reset request", () => {
  it("requires an email before calling the provider", async () => {
    render(<TeacherLoginPage />);
    await clickForgotPassword();
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "Enter your email above to reset your password.",
    );
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("blocks invalid email formats without calling the provider", async () => {
    const user = userEvent.setup();
    render(<TeacherLoginPage />);
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Please enter a valid email address.");
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("trims whitespace and sends the normalized email with the recovery callback URL", async () => {
    const user = userEvent.setup();
    render(<TeacherLoginPage />);
    await user.type(screen.getByLabelText("Email"), "  Teacher@School.edu  ");
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    const normalizedEmail = "Teacher@School.edu";
    const expectedRedirect = buildTeacherPasswordResetRedirectTo(window.location.origin);

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(normalizedEmail, {
      redirectTo: expectedRedirect,
    });
    expect(expectedRedirect).toContain(encodeURIComponent(TEACHER_RESET_PASSWORD_PATH));
    expect(await screen.findByRole("status")).toHaveTextContent(getTeacherPasswordResetMessage(normalizedEmail));
  });

  it.each(["returned", "thrown"])(
    "shows a retryable error and no success notice after a %s provider failure",
    async (failure) => {
      if (failure === "returned") {
        mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: "Rate limit exceeded" } });
      } else {
        mocks.resetPasswordForEmail.mockRejectedValue(new Error("network failure"));
      }

      const user = userEvent.setup();
      render(<TeacherLoginPage />);
      await user.type(screen.getByLabelText("Email"), "teacher@example.com");
      await user.click(screen.getByRole("button", { name: "Forgot password?" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC_RETRY_MESSAGE);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Forgot password?" })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: "Forgot password?" }));
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledTimes(2);
    },
  );
});
