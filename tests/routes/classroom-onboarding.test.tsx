// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signup: vi.fn(), create: vi.fn(), push: vi.fn(), copy: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/app/create-account/student/actions", () => ({ signupStudent: mocks.signup }));
vi.mock("@/app/admin/create-class/actions", () => ({ createClass: mocks.create }));
import StudentSignup from "@/app/create-account/student/page";
import CreateClass from "@/app/admin/create-class/page";
import CopyClassCode from "@/app/admin/classes/CopyClassCode";
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
beforeEach(() => {
  vi.resetAllMocks(); mocks.signup.mockResolvedValue({ ok: true }); mocks.create.mockResolvedValue({ ok: true, classId: "class-id" });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.copy } });
});
afterEach(() => {
  cleanup();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});
const field = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function join() {
  field("First Name", "Alex"); field("Last Name", "Student"); field("Student ID", "DEMO1"); field("Classroom code", "ABC123");
  fireEvent.click(screen.getByRole("button", { name: "Join class" }));
}

describe("bounded classroom onboarding", () => {
  it("finishes student joining inline with a sign-in destination, without navigating or claiming login", async () => {
    render(<StudentSignup />); await join();
    expect(await screen.findByRole("status")).toHaveTextContent("Sign in with your Student ID and classroom code");
    expect(screen.getByRole("link", { name: "Sign in as a student" })).toHaveAttribute("href", "/login/student");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each(["returned", "thrown"])("retains student inputs and allows retry after a %s join failure", async kind => {
    if (kind === "returned") mocks.signup.mockResolvedValue({ ok: false, message: "Try again." });
    else mocks.signup.mockRejectedValue(new Error("private"));
    render(<StudentSignup />); await join();
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private");
    expect(screen.getByLabelText("Student ID")).toHaveValue("DEMO1");
    expect(screen.getByRole("button", { name: "Join class" })).toBeEnabled();
  });
  it("opens the newly created classroom rather than clearing the form in place", async () => {
    render(<CreateClass />); field("Class name", "Chemistry A"); field("Class code", "abc123");
    fireEvent.click(screen.getByRole("button", { name: "Create class" }));
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin?classId=class-id&classCreated=1"));
    expect(mocks.create).toHaveBeenCalledWith({ className: "Chemistry A", section: "", classCode: "ABC123", codeSource: "manual" });
  });
  it("locks repeat creation while pending and preserves a draft after transport failure", async () => {
    let reject!: (reason: Error) => void;
    mocks.create.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    render(<CreateClass />); field("Class name", "Chemistry A"); field("Class code", "ABC123");
    fireEvent.click(screen.getByRole("button", { name: "Create class" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await act(async () => { reject(new Error("private")); });
    expect(screen.getByRole("alert")).toHaveTextContent("Check your classrooms before trying again");
    expect(screen.getByLabelText("Class name")).toHaveValue("Chemistry A");
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("copies only the code, announces success, and provides a manual fallback", async () => {
    const user = userEvent.setup();
    // userEvent installs a clipboard stub; replace it with the explicit test mock.
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.copy } });
    mocks.copy.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("private"));
    render(<CopyClassCode code="ABC123" />);
    await user.click(screen.getByRole("button", { name: "Copy classroom code" }));
    expect(mocks.copy).toHaveBeenCalledWith("ABC123");
    expect(await screen.findByRole("status")).toHaveTextContent("Classroom code copied");
    await user.click(screen.getByRole("button", { name: "Copy classroom code" }));
    expect(await screen.findByRole("status")).toHaveTextContent("copy it manually");
    expect(screen.getByText(/Students choose Join a class/)).toBeInTheDocument();
  });
});
