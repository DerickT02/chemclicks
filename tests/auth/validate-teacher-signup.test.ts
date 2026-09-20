import { describe, expect, it } from "vitest";
import {
  TEACHER_PASSWORD_FORBIDDEN_CHARS,
  TEACHER_PASSWORD_MIN_LENGTH,
  validateTeacherEmail,
  validateTeacherPassword,
  validateTeacherSignup,
} from "../../src/lib/auth/validate-teacher-signup";

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

describe("validateTeacherPassword", () => {
  it("rejects empty password", () => {
    expect(validateTeacherPassword("")).toBe("Password is required.");
  });

  it("rejects whitespace characters (spaces, tabs, newlines, carriage returns)", () => {
    expect(validateTeacherPassword("Pass word!1")).toBe(
      "Password cannot contain spaces or line breaks.",
    );
    expect(validateTeacherPassword("Password!\t1")).toBe(
      "Password cannot contain spaces or line breaks.",
    );
    expect(validateTeacherPassword("Password!\n1")).toBe(
      "Password cannot contain spaces or line breaks.",
    );
    expect(validateTeacherPassword("Password!\r1")).toBe(
      "Password cannot contain spaces or line breaks.",
    );
    expect(validateTeacherPassword(" Password!1")).toBe(
      "Password cannot contain spaces or line breaks.",
    );
    expect(validateTeacherPassword("Password!1 ")).toBe(
      "Password cannot contain spaces or line breaks.",
    );
  });

  it.each([
    ['"', 'double quote'],
    ["'", 'single quote'],
    ["\\", 'backslash'],
    ["/", 'forward slash'],
    ["`", 'backtick'],
    [";", 'semicolon'],
    ["$", 'dollar sign'],
  ])("rejects password containing forbidden special %s (%s)", (char) => {
    const error = validateTeacherPassword(`Password${char}123`);
    expect(error).toBe("Password cannot contain any of: \" ' \\ / ` ; $");
  });

  it("checks all characters in TEACHER_PASSWORD_FORBIDDEN_CHARS", () => {
    for (const char of TEACHER_PASSWORD_FORBIDDEN_CHARS) {
      expect(validateTeacherPassword(`Abcdef1${char}`)).toBe(
        "Password cannot contain any of: \" ' \\ / ` ; $",
      );
    }
  });

  it(`enforces minimum length of ${TEACHER_PASSWORD_MIN_LENGTH}`, () => {
    expect(validateTeacherPassword("Ab1!xyz")).toBe(
      `Password must be at least ${TEACHER_PASSWORD_MIN_LENGTH} characters.`,
    );
    expect(validateTeacherPassword("Ab1!xyzw")).toBeUndefined();
  });

  it("requires at least one letter", () => {
    expect(validateTeacherPassword("1234567!")).toBe(
      "Password must include at least one letter.",
    );
  });

  it("requires at least one number", () => {
    expect(validateTeacherPassword("Abcdefgh!")).toBe(
      "Password must include at least one number.",
    );
  });

  it("requires at least one allowed special character", () => {
    expect(validateTeacherPassword("Abcdefg1")).toBe(
      "Password must include at least one special character, but not \" ' \\ / ` ; $",
    );
  });

describe("validateTeacherPassword allowed specials & ordering", () => {
  it.each([
    ["!", "exclamation"],
    ["#", "hash"],
    ["%", "percent"],
    ["&", "ampersand"],
    ["(", "open paren"],
    [")", "close paren"],
    ["*", "asterisk"],
    ["+", "plus"],
    [",", "comma"],
    ["-", "hyphen"],
    [".", "period"],
    [":", "colon"],
    ["<", "less than"],
    ["=", "equals"],
    [">", "greater than"],
    ["?", "question mark"],
    ["@", "at"],
    ["[", "open bracket"],
    ["]", "close bracket"],
    ["^", "caret"],
    ["_", "underscore"],
    ["{", "open brace"],
    ["|", "pipe"],
    ["}", "close brace"],
    ["~", "tilde"],
  ])("accepts allowed special character %s (%s)", (char) => {
    expect(validateTeacherPassword(`Password1${char}`)).toBeUndefined();
  });

  it("evaluates rules in the expected precedence order", () => {
    expect(validateTeacherPassword("")).toBe("Password is required.");

    expect(validateTeacherPassword("a $")).toBe(
      "Password cannot contain spaces or line breaks.",
    );

    expect(validateTeacherPassword("a$")).toBe(
      "Password cannot contain any of: \" ' \\ / ` ; $",
    );

    expect(validateTeacherPassword("123!")).toBe(
      `Password must be at least ${TEACHER_PASSWORD_MIN_LENGTH} characters.`,
    );
  });
});

describe("validateTeacherSignup", () => {
  it("returns valid: true when all fields pass", () => {
    const result = validateTeacherSignup(
      "teacher@example.com",
      "CorrectHorse!1",
      "CorrectHorse!1",
    );
    expect(result).toEqual({ valid: true });
  });

  it("returns all applicable field errors when multiple fields fail", () => {
    const result = validateTeacherSignup(
      "not-an-email",
      "short",
      "",
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.emailError).toBe("Please enter a valid email address.");
      expect(result.passwordError).toBe(
        `Password must be at least ${TEACHER_PASSWORD_MIN_LENGTH} characters.`,
      );
      expect(result.confirmError).toBe("Please confirm your password.");
    }
  });

  it("validates password confirmation matching", () => {
    const result = validateTeacherSignup(
      "teacher@example.com",
      "CorrectHorse!1",
      "DifferentHorse!1",
    );
    expect(result).toEqual({
      valid: false,
      emailError: undefined,
      passwordError: undefined,
      confirmError: "Passwords do not match.",
    });
  });

  it("blocks submission when password contains a forbidden special", () => {
    const result = validateTeacherSignup(
      "teacher@example.com",
      "TeacherPass;1",
      "TeacherPass;1",
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.passwordError).toBe(
        "Password cannot contain any of: \" ' \\ / ` ; $",
      );
    }
  });

  it("blocks submission when password contains spaces", () => {
    const result = validateTeacherSignup(
      "teacher@example.com",
      "Teacher Pass!1",
      "Teacher Pass!1",
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.passwordError).toBe(
        "Password cannot contain spaces or line breaks.",
      );
    }
  });
});

});
