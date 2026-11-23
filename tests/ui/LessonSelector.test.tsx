// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_LESSONS, LessonSelector } from "@/app/admin/classes/[classId]/activities/[assignmentId]/LessonSelector";

const onChange = vi.fn();
const assignments = [
  { id: "ruler", title: "Ruler" },
  { id: "lewis", title: "Lewis diagrams" },
];

beforeEach(() => onChange.mockReset());
afterEach(cleanup);

describe("LessonSelector", () => {
  it("shows the current lesson as the heading and requests another lesson on selection", async () => {
    const user = userEvent.setup();
    render(<LessonSelector assignmentId="lewis" assignments={assignments} onChange={onChange} />);
    const dropdown = screen.getByRole("combobox", { name: "Lesson" });
    expect(dropdown).toHaveTextContent("Lewis diagrams");
    expect(dropdown).toHaveClass("rounded-xl", "border", "border-border", "bg-card", "px-4", "py-2.5", "shadow-sm", "hover:border-accent");
    const heading = screen.getByRole("heading", { level: 1, name: "Lewis diagrams" });
    expect(heading).toContainElement(dropdown);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await user.click(dropdown);
    expect(dropdown).toHaveClass("border-accent", "ring-2");
    expect(heading).not.toContainElement(screen.getByRole("listbox"));
    expect(heading).toHaveAccessibleName("Lewis diagrams");
    expect(screen.getByRole("option", { name: "Lewis diagrams" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Ruler" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("ruler");
  });

  it("supports selecting See all with the keyboard", async () => {
    const user = userEvent.setup();
    render(<LessonSelector assignmentId="lewis" assignments={assignments} onChange={onChange} />);
    screen.getByRole("combobox", { name: "Lesson" }).focus();
    await user.keyboard("{ArrowDown}{Home}{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(ALL_LESSONS);
  });

  it("closes the heading dropdown with Escape without changing the lesson", async () => {
    const user = userEvent.setup();
    render(<LessonSelector assignmentId="lewis" assignments={assignments} onChange={onChange} />);
    const dropdown = screen.getByRole("combobox", { name: "Lesson" });
    dropdown.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(dropdown).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers See all even when the class has only one lesson", async () => {
    const user = userEvent.setup();
    render(<LessonSelector assignmentId="ruler" assignments={[assignments[0]]} onChange={onChange} />);
    await user.click(screen.getByRole("combobox", { name: "Lesson" }));
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.click(screen.getByRole("option", { name: "See all" }));
    expect(onChange).toHaveBeenCalledWith(ALL_LESSONS);
  });

  it("reflects the owner's selection and avoids reselecting the current lesson", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LessonSelector assignmentId="lewis" assignments={assignments} onChange={onChange} />);
    rerender(<LessonSelector assignmentId="ruler" assignments={assignments} onChange={onChange} />);
    const dropdown = screen.getByRole("combobox", { name: "Lesson" });
    expect(dropdown).toHaveTextContent("Ruler");
    expect(screen.getByRole("heading", { level: 1, name: "Ruler" })).toContainElement(dropdown);
    await user.click(dropdown);
    await user.click(screen.getByRole("option", { name: "Ruler" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(dropdown).toHaveAttribute("aria-expanded", "false");
  });
});
