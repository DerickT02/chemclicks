import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Client-component tests should not execute the Next.js server action module.
// The real action is exercised through the server-action integration boundary.
vi.mock("@/app/(student)/student/quizzes/actions", () => ({
  submitQuizAction: vi.fn(),
}));
