/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthSessionMissingError, AuthWeakPasswordError } from "@supabase/supabase-js";
import { TEACHER_PASSWORD_MIN_LENGTH } from "@/lib/auth/validate-teacher-signup";

// SCRUM-55: the teacher password policy as enforced today by the signup and
// reset forms (validateTeacherPassword), and how Auth rejections surface.
const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), signUp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), push: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import TeacherCreateAccountPage from "@/app/create-account/teacher/page";
import TeacherResetPasswordPage from "@/app/login/teacher/reset-password/page";

const VALID_PASSWORD = "Chemistry1!";
const FORBIDDEN_MESSAGE = "Password cannot contain any of: \" ' \\ / ` ; $";

// One case per rule, in the validator's precedence order.
const RULE_VIOLATIONS: [rule: string, password: string, message: string][] = [
  ["is required", "", "Password is required."],
  ["has no spaces or line breaks", "Pass word1!", "Password cannot contain spaces or line breaks."],
  ["has no forbidden characters", "Password1$", FORBIDDEN_MESSAGE],
  [`has at least ${TEACHER_PASSWORD_MIN_LENGTH} characters`, "Ab1!xyz", `Password must be at least ${TEACHER_PASSWORD_MIN_LENGTH} characters.`],
  ["includes a letter", "1234567!", "Password must include at least one letter."],
  ["includes a number", "Abcdefgh!", "Password must include at least one number."],
  ["includes an allowed special character", "Abcdefg1", "Password must include at least one special character, but not \" ' \\ / ` ; $"],
];

let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockImplementation(() => ({
    auth: { signUp: mocks.signUp, updateUser: mocks.updateUser, signOut: mocks.signOut },
  }));
  mocks.signUp.mockResolvedValue({ data: { user: { id: "teacher", identities: [{}] } }, error: null });
  mocks.updateUser.mockResolvedValue({ data: { user: { id: "teacher" } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  consoleSpies = (["log", "info", "warn", "error"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}));
});

afterEach(() => {
  cleanup();
  consoleSpies.forEach((spy) => spy.mockRestore());
});

/** The password must never appear in rendered text or in console output. */
function expectPasswordNotExposed(password: string) {
  if (!password) return;
  expect(document.body).not.toHaveTextContent(password);
  for (const spy of consoleSpies) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain(password);
  }
}

describe("teacher signup password policy", () => {
  async function submitSignup(password: string, confirmPassword = password) {
    const user = userEvent.setup();
    render(<TeacherCreateAccountPage />);
    await user.type(screen.getByLabelText("Display name"), "Ms. Smith");
    await user.type(screen.getByLabelText("Email"), "  teacher@school.edu  ");
    if (password) await user.type(screen.getByLabelText("Password", { exact: true }), password);
    if (confirmPassword) await user.type(screen.getByLabelText("Confirm password"), confirmPassword);
    await user.click(screen.getByRole("button", { name: "Create account" }));
  }

  it("lists the password rules beside the password field", () => {
    render(<TeacherCreateAccountPage />);
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAccessibleDescription(
      "At least 8 characters with a letter, number, and special character (no spaces, and no \" ' \\ / ` ; $).",
    );
  });

  it.each(RULE_VIOLATIONS)("blocks signup unless the password %s", async (_rule, password, message) => {
    await submitSignup(password);
    const field = screen.getByLabelText("Password", { exact: true });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(mocks.signUp).not.toHaveBeenCalled();
    expectPasswordNotExposed(password);
  });

  it("blocks signup when the confirmation does not match", async () => {
    await submitSignup(VALID_PASSWORD, "Chemistry2!");
    const confirm = screen.getByLabelText("Confirm password");
    expect(confirm).toHaveAccessibleDescription("Passwords do not match.");
    expect(screen.getByLabelText("Password", { exact: true })).not.toHaveAttribute("aria-invalid");
    expect(mocks.signUp).not.toHaveBeenCalled();
    expectPasswordNotExposed(VALID_PASSWORD);
  });

  it("blocks signup when the confirmation is empty", async () => {
    await submitSignup(VALID_PASSWORD, "");
    expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription("Please confirm your password.");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("sends a valid, confirmed password to Auth and continues to email verification", async () => {
    await submitSignup(VALID_PASSWORD);
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "teacher@school.edu",
      password: VALID_PASSWORD,
      options: expect.objectContaining({ data: { display_name: "Ms. Smith" } }),
    }));
    // The password only goes to Auth; it is never part of the profile metadata.
    expect(JSON.stringify(mocks.signUp.mock.calls[0][0].options)).not.toContain(VALID_PASSWORD);
    expectPasswordNotExposed(VALID_PASSWORD);
  });

  it("does not create an account when Auth rejects the password", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthWeakPasswordError("Password is known to be weak and easy to guess.", 422, ["pwned"]),
    });
    await submitSignup(VALID_PASSWORD);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
    expect(screen.getByLabelText("Confirm password")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
    expectPasswordNotExposed(VALID_PASSWORD);
  });
});

describe("teacher password reset policy", () => {
  async function submitReset(password: string, confirmPassword = password) {
    const user = userEvent.setup();
    render(<TeacherResetPasswordPage />);
    if (password) await user.type(screen.getByLabelText("New password"), password);
    if (confirmPassword) await user.type(screen.getByLabelText("Confirm new password"), confirmPassword);
    await user.click(screen.getByRole("button", { name: "Update password" }));
  }

  it("lists the same password rules as signup", () => {
    render(<TeacherResetPasswordPage />);
    expect(screen.getByLabelText("New password")).toHaveAccessibleDescription(
      "At least 8 characters with a letter, number, and special character (no spaces, and no \" ' \\ / ` ; $).",
    );
  });

  it.each(RULE_VIOLATIONS)("blocks the reset unless the password %s", async (_rule, password, message) => {
    await submitReset(password);
    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(field).toHaveValue("");
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expectPasswordNotExposed(password);
  });

  it("blocks the reset when the confirmation does not match", async () => {
    await submitReset(VALID_PASSWORD, "Chemistry2!");
    expect(screen.getByLabelText("Confirm new password")).toHaveAccessibleDescription("Passwords do not match.");
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expectPasswordNotExposed(VALID_PASSWORD);
  });

  it("updates a valid password, ends the recovery session and returns to sign-in", async () => {
    await submitReset(VALID_PASSWORD);
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login/teacher?password=reset"));
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: VALID_PASSWORD });
    expect(mocks.signOut).toHaveBeenCalled();
    expectPasswordNotExposed(VALID_PASSWORD);
  });

  it("shows the Auth rejection when the server policy refuses the password", async () => {
    const message = "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.";
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: new AuthWeakPasswordError(message, 422, ["characters"]),
    });
    await submitReset(VALID_PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expectPasswordNotExposed(VALID_PASSWORD);
  });

  it("asks for a new link when the recovery session has expired", async () => {
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    await submitReset(VALID_PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your reset link is invalid or has expired.");
    expect(mocks.push).not.toHaveBeenCalled();
    expectPasswordNotExposed(VALID_PASSWORD);
  });
});
