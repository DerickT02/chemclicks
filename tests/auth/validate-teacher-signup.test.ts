import { describe, expect, it } from "vitest";
import {
  TEACHER_PASSWORD_MIN_LENGTH,
  validateTeacherDisplayName,
  validateTeacherEmail,
  validateTeacherSignup,
} from "../../src/lib/auth/validate-teacher-signup";

describe("validateTeacherDisplayName", () => {
  it("rejects empty or whitespace-only display names", () => {
    expect(validateTeacherDisplayName("")).toBe("Display name is required.");
    expect(validateTeacherDisplayName("   ")).toBe("Display name is required.");
  });

  it("accepts valid display names", () => {
    expect(validateTeacherDisplayName("Ms. Smith")).toBeUndefined();
    expect(validateTeacherDisplayName("  Dr. Adams  ")).toBeUndefined();
  });
});

describe("validateTeacherEmail", () => {
  it("rejects empty or whitespace-only emails", () => {
    expect(validateTeacherEmail("")).toBe("Email is required.");
    expect(validateTeacherEmail("   ")).toBe("Email is required.");
  });

  it("rejects invalid email formats", () => {
    expect(validateTeacherEmail("teacher")).toBe("Please enter a valid email address.");
    expect(validateTeacherEmail("teacher@")).toBe("Please enter a valid email address.");
    expect(validateTeacherEmail("teacher@domain")).toBe("Please enter a valid email address.");
  });

  it("accepts valid email with leading/trailing whitespace", () => {
    expect(validateTeacherEmail("  teacher@school.edu  ")).toBeUndefined();
  });
});

describe("validateTeacherSignup", () => {
  it("returns valid: true when all fields pass", () => {
    const result = validateTeacherSignup(
      "Ms. Smith",
      "teacher@example.com",
      "TeacherPass1",
      "TeacherPass1",
    );
    expect(result).toEqual({ valid: true });
  });

  it("returns displayNameError when display name is missing", () => {
    const result = validateTeacherSignup(
      "",
      "teacher@example.com",
      "TeacherPass1",
      "TeacherPass1",
    );
    expect(result).toEqual({
      valid: false,
      displayNameError: "Display name is required.",
      emailError: undefined,
      passwordError: undefined,
      confirmError: undefined,
    });
  });

  it("returns all applicable field errors when multiple fields fail", () => {
    const result = validateTeacherSignup(
      "",
      "not-an-email",
      "short",
      "",
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.displayNameError).toBe("Display name is required.");
      expect(result.emailError).toBe("Please enter a valid email address.");
      expect(result.passwordError).toBe(
        `Password must be at least ${TEACHER_PASSWORD_MIN_LENGTH} characters.`,
      );
      expect(result.confirmError).toBe("Please confirm your password.");
    }
  });

  it("validates password confirmation matching", () => {
    const result = validateTeacherSignup(
      "Ms. Smith",
      "teacher@example.com",
      "TeacherPass1",
      "DifferentPass1",
    );
    expect(result).toEqual({
      valid: false,
      displayNameError: undefined,
      emailError: undefined,
      passwordError: undefined,
      confirmError: "Passwords do not match.",
    });
  });
});
