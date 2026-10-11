// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  createClass: vi.fn(),
  generateClassCode: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/admin/create-class/actions", () => ({
  createClass: mock.createClass,
  generateClassCode: mock.generateClassCode,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mock.refresh }) }));

import CreateClassPage from "@/app/admin/create-class/page";

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

const codeInput = () => screen.getByLabelText("Class code");

describe("create class form", () => {
  it("generates a code and replaces it on regenerate", async () => {
    const user = userEvent.setup();
    mock.generateClassCode
      .mockResolvedValueOnce({ ok: true, code: "A1B2C3" })
      .mockResolvedValueOnce({ ok: true, code: "Z9Y8X7" });
    render(<CreateClassPage />);

    await user.click(screen.getByRole("button", { name: "Generate code" }));
    expect(codeInput()).toHaveValue("A1B2C3");
    expect(screen.getByText(/Generated code A1B2C3/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(codeInput()).toHaveValue("Z9Y8X7");
  });

  it("saves a generated code with its source", async () => {
    const user = userEvent.setup();
    mock.generateClassCode.mockResolvedValue({ ok: true, code: "A1B2C3" });
    mock.createClass.mockResolvedValue({ ok: true, classId: "class-1", classCode: "A1B2C3" });
    render(<CreateClassPage />);

    await user.type(screen.getByLabelText("Class name"), "Chem 3");
    await user.click(screen.getByRole("button", { name: "Generate code" }));
    await user.click(screen.getByRole("button", { name: "Create class" }));

    expect(mock.createClass).toHaveBeenCalledWith({
      className: "Chem 3",
      section: "",
      classCode: "A1B2C3",
      codeSource: "generated",
    });
    expect(await screen.findByText("Class created with code A1B2C3.")).toBeInTheDocument();
  });

  it("switches back to manual when the teacher edits a generated code", async () => {
    const user = userEvent.setup();
    mock.generateClassCode.mockResolvedValue({ ok: true, code: "A1B2C3" });
    mock.createClass.mockResolvedValue({ ok: true, classId: "class-1", classCode: "MINE12" });
    render(<CreateClassPage />);

    await user.type(screen.getByLabelText("Class name"), "Chem 3");
    await user.click(screen.getByRole("button", { name: "Generate code" }));
    await user.clear(codeInput());
    await user.type(codeInput(), "mine12");
    expect(screen.queryByText(/Generated code/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create class" }));

    expect(mock.createClass).toHaveBeenCalledWith(
      expect.objectContaining({ classCode: "MINE12", codeSource: "manual" }),
    );
    expect(await screen.findByText("Class created with code MINE12.")).toBeInTheDocument();
  });

  it("keeps the entered values and shows an accessible error for a duplicate code", async () => {
    const user = userEvent.setup();
    mock.createClass.mockResolvedValue({
      ok: false,
      field: "classCode",
      message: "That class code is already in use. Please choose a different code.",
    });
    render(<CreateClassPage />);

    await user.type(screen.getByLabelText("Class name"), "Chem 3");
    await user.type(screen.getByLabelText(/Section/), "Room 204");
    await user.type(codeInput(), "TAKEN1");
    await user.click(screen.getByRole("button", { name: "Create class" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already in use");
    expect(codeInput()).toHaveAttribute("aria-invalid", "true");
    expect(codeInput()).toHaveAttribute("aria-describedby", expect.stringContaining("classCode-error"));
    expect(screen.getByLabelText("Class name")).toHaveValue("Chem 3");
    expect(screen.getByLabelText(/Section/)).toHaveValue("Room 204");
    expect(codeInput()).toHaveValue("TAKEN1");
  });

  it("keeps the entered values and shows an accessible error for a duplicate name and section", async () => {
    const user = userEvent.setup();
    mock.createClass.mockResolvedValue({
      ok: false,
      field: "nameSection",
      message: "You already have a class with this name and section. Change the name or section and try again.",
    });
    render(<CreateClassPage />);

    await user.type(screen.getByLabelText("Class name"), "Chem 3");
    await user.type(screen.getByLabelText(/Section/), "Room 204");
    await user.type(codeInput(), "A1B2C3");
    await user.click(screen.getByRole("button", { name: "Create class" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already have a class with this name and section");
    for (const field of [screen.getByLabelText("Class name"), screen.getByLabelText(/Section/)]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAttribute("aria-describedby", expect.stringContaining("nameSection-error"));
    }
    expect(codeInput()).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Class name")).toHaveValue("Chem 3");
    expect(screen.getByLabelText(/Section/)).toHaveValue("Room 204");
    expect(codeInput()).toHaveValue("A1B2C3");

    await user.type(screen.getByLabelText(/Section/), "B");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Class name")).not.toHaveAttribute("aria-invalid");
  });

  it("shows a generation failure without clearing other inputs", async () => {
    const user = userEvent.setup();
    mock.generateClassCode.mockResolvedValue({
      ok: false,
      message: "Couldn't generate a unique code. Try again or enter one manually.",
    });
    render(<CreateClassPage />);

    await user.type(screen.getByLabelText("Class name"), "Chem 3");
    await user.click(screen.getByRole("button", { name: "Generate code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("unique code");
    expect(screen.getByLabelText("Class name")).toHaveValue("Chem 3");
  });

  it("submits only once when the button is clicked repeatedly", async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    mock.createClass.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<CreateClassPage />);

    await user.type(screen.getByLabelText("Class name"), "Chem 3");
    await user.type(codeInput(), "A1B2C3");
    const submit = screen.getByRole("button", { name: "Create class" });
    await user.dblClick(submit);
    await user.click(submit);

    expect(mock.createClass).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate code" })).toBeDisabled();

    resolve({ ok: true, classId: "class-1", classCode: "A1B2C3" });
    await waitFor(() => expect(screen.getByText("Class created with code A1B2C3.")).toBeInTheDocument());
  });
});
