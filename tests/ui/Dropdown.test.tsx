// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import Dropdown from "@/components/ui/Dropdown";

const options = [
  { value: "neutral", label: "Neutral atom", description: "6 electrons" },
  { value: "carbide", label: "Carbide (C4−)", description: "10 electrons" },
];

function ExampleDropdown({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState("neutral");
  return (
    <>
      <Dropdown label="Electrons" value={value} options={options} onChange={setValue} disabled={disabled} />
      <button type="button">Outside button</button>
    </>
  );
}

afterEach(cleanup);

describe("Dropdown", () => {
  it("shows a styled list, selects with a click, and closes when clicked outside", async () => {
    const user = userEvent.setup();
    render(<ExampleDropdown />);
    const dropdown = screen.getByRole("combobox", { name: "Electrons" });
    expect(dropdown).toHaveTextContent("Neutral atom");

    await user.click(dropdown);
    expect(dropdown).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: /Neutral atom/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: /Carbide \(C4−\)/ }));
    expect(dropdown).toHaveTextContent("Carbide (C4−)");
    expect(dropdown).toHaveAttribute("aria-expanded", "false");
    expect(dropdown).toHaveFocus();

    await user.click(dropdown);
    await user.click(screen.getByRole("button", { name: "Outside button" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation, Escape, and Tab", async () => {
    const user = userEvent.setup();
    render(<ExampleDropdown />);
    const dropdown = screen.getByRole("combobox", { name: "Electrons" });

    dropdown.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(dropdown).toHaveTextContent("Carbide (C4−)");
    await user.keyboard("{ArrowUp}{Home}");
    expect(dropdown).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: /Neutral atom/ }).id);
    await user.keyboard("{Escape}");
    expect(dropdown).toHaveTextContent("Carbide (C4−)");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Tab}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Outside button" })).toHaveFocus();
  });

  it("cannot open when disabled", async () => {
    const user = userEvent.setup();
    render(<ExampleDropdown disabled />);
    const dropdown = screen.getByRole("combobox", { name: "Electrons" });
    expect(dropdown).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Outside button" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
