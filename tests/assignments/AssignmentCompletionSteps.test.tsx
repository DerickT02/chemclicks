// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { AssignmentCompletionSteps } from "@/components/assignments/AssignmentCompletionSteps";

afterEach(cleanup);

describe("AssignmentCompletionSteps", () => {
  it.each([
    ["not_started", 0],
    ["exploring", 1],
    ["explored", 2],
    ["quiz_in_progress", 2],
    ["needs_retry", 2],
    ["completed", 3],
  ] as const)("shows the completed milestones and next step for %s", (stage, completed) => {
    render(<AssignmentCompletionSteps stage={stage} label="Alex Kim, Bohr Models" />);
    const list = screen.getByRole("list", { name: "Alex Kim, Bohr Models, assignment completion" });
    expect(list.tagName).toBe("OL");
    const steps = within(list).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    for (const [index, step] of steps.entries()) {
      const label = ["Started", "Exploration finished", "Quiz passed"][index];
      expect(within(step).getByText(label)).toBeInTheDocument();
      if (index < completed) {
        expect(step).toHaveTextContent(", completed");
        expect(step.querySelectorAll("svg")).toHaveLength(2);
        expect(step.querySelector("svg")).toHaveClass("fill-accent", "stroke-accent");
        expect(step).not.toHaveAttribute("aria-current");
      } else if (index === completed) {
        expect(step).toHaveAttribute("aria-current", "step");
        expect(step).toHaveTextContent(", current step");
        expect(step.querySelector("svg")).toHaveClass("fill-accent/10", "stroke-accent");
      } else {
        expect(step).toHaveTextContent(", not completed");
        expect(step).not.toHaveAttribute("aria-current");
        expect(step.querySelector("svg")).toHaveClass("fill-muted", "stroke-border");
      }
    }
    expect(list).not.toHaveTextContent("%");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("updates the step states when live progress changes", () => {
    const { rerender } = render(<AssignmentCompletionSteps stage="exploring" label="Alex Kim" />);
    expect(screen.getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    rerender(<AssignmentCompletionSteps stage="completed" label="Alex Kim" />);
    for (const step of screen.getAllByRole("listitem")) {
      expect(step).not.toHaveAttribute("aria-current");
      expect(step).toHaveTextContent(", completed");
    }
  });

  it("keeps the steps compact and tightly joined on wider screens", () => {
    render(<AssignmentCompletionSteps stage="exploring" label="Alex Kim" />);
    expect(screen.getByRole("list")).toHaveClass("sm:max-w-xl", "sm:gap-0");
    const steps = screen.getAllByRole("listitem");
    for (const step of steps) expect(step).toHaveClass("min-h-9", "px-4", "py-2", "text-xs");
    expect(steps[0]).not.toHaveClass("sm:-ml-4");
    for (const step of steps.slice(1)) expect(step).toHaveClass("sm:-ml-4");
  });

  it("renders chevron segments on the server with a layout that stacks on small screens", () => {
    const html = renderToStaticMarkup(<AssignmentCompletionSteps stage="explored" label="Alex Kim" />);
    expect(html).toContain("sm:grid-cols-3");
    expect(html.match(/<polygon /g)).toHaveLength(3);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(5);
    expect(html).toContain('aria-current="step"');
  });
});
