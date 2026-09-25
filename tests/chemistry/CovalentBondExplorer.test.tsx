/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../quiz/setup";
import CovalentBondExplorer from "@/components/lewis/CovalentBondExplorer";

afterEach(cleanup);

const GROUPS = [
  { name: "Single bonds", buttons: ["Hydrogen gas, H2", "Hydrogen fluoride, HF", "Water, H2O", "Ammonia, NH3", "Methane, CH4"] },
  { name: "Double bonds", buttons: ["Oxygen gas, O2", "Carbon dioxide, CO2"] },
  { name: "Triple bonds", buttons: ["Nitrogen gas, N2"] },
] as const;

const MOLECULES = [
  { button: "Oxygen gas, O2", name: "Oxygen gas", bondType: "Double bond — 2 shared pairs (4 electrons)", bonds: "1 double bond", shared: "2", lone: "4(2 on each oxygen)", diagram: /Diagram of oxygen gas: 1 double bond/ },
  { button: "Nitrogen gas, N2", name: "Nitrogen gas", bondType: "Triple bond — 3 shared pairs (6 electrons)", bonds: "1 triple bond", shared: "3", lone: "2(1 on each nitrogen)", diagram: /Diagram of nitrogen gas: 1 triple bond/ },
  { button: "Methane, CH4", name: "Methane", bondType: "Single bond — 1 shared pair (2 electrons)", bonds: "4 single bonds", shared: "4", lone: "None", diagram: /Diagram of methane: 4 single bonds between carbon and hydrogen/ },
] as const;

function detailRow(label: string) {
  return screen.getByText(label, { selector: "dt" }).parentElement as HTMLElement;
}

describe("CovalentBondExplorer", () => {
  it("groups all eight molecules by bond type, with hydrogen selected", () => {
    render(<CovalentBondExplorer />);

    for (const group of GROUPS) {
      const region = within(screen.getByRole("group", { name: group.name }));
      expect(region.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(group.buttons);
    }
    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(screen.getAllByRole("button", { pressed: true })).toEqual([
      screen.getByRole("button", { name: "Hydrogen gas, H2" }),
    ]);
    expect(screen.getByRole("group", { name: "Double bonds" })).toHaveAccessibleDescription(
      "2 shared pairs per bond (4 electrons)",
    );
  });

  it("describes hydrogen by default", () => {
    render(<CovalentBondExplorer />);

    expect(detailRow("Formula")).toHaveTextContent("H₂");
    expect(detailRow("Atoms")).toHaveTextContent("2 hydrogen");
    expect(detailRow("Total shared pairs")).toHaveTextContent("1(2 electrons)");
    expect(detailRow("Lone pairs")).toHaveTextContent("None");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Diagram of hydrogen gas: 1 single bond between the two hydrogen atoms (1 shared pair); no lone pairs.",
    );
  });

  it.each(MOLECULES)("updates the details, diagram and caption together for $name", async (molecule) => {
    const user = userEvent.setup();
    render(<CovalentBondExplorer />);

    await user.click(screen.getByRole("button", { name: molecule.button }));

    expect(screen.getByRole("button", { name: molecule.button })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(detailRow("Name")).toHaveTextContent(molecule.name);
    expect(detailRow("Bond type")).toHaveTextContent(molecule.bondType);
    expect(detailRow("Bonds")).toHaveTextContent(molecule.bonds);
    expect(detailRow("Total shared pairs")).toHaveTextContent(molecule.shared);
    expect(detailRow("Lone pairs")).toHaveTextContent(molecule.lone);
    const diagram = screen.getByRole("img", { name: molecule.diagram });
    expect(diagram).toHaveAccessibleDescription(new RegExp(`^${molecule.name} \\(`));
    expect(screen.getByRole("figure")).toHaveTextContent(`${molecule.name} (`);
  });

  it("draws one dot per electron: two per shared pair and two per lone pair", async () => {
    const user = userEvent.setup();
    const { container } = render(<CovalentBondExplorer />);

    expect(container.querySelectorAll("svg circle")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Carbon dioxide, CO2" }));
    // 4 valence electrons from carbon + 6 from each oxygen.
    expect(container.querySelectorAll("svg circle")).toHaveLength(16);
    await user.click(screen.getByRole("button", { name: "Nitrogen gas, N2" }));
    expect(container.querySelectorAll("svg circle")).toHaveLength(10);
  });

  it("explains the diagram colors in text, not color alone", () => {
    render(<CovalentBondExplorer />);

    const figure = within(screen.getByRole("figure"));
    expect(figure.getByText("Shared pair (bonding electrons)")).toBeInTheDocument();
    expect(figure.getByText("Lone pair (non-bonding electrons)")).toBeInTheDocument();
  });

  it("does not call elements like H₂ compounds, and notes the diagram is not the 3D shape", () => {
    render(<CovalentBondExplorer />);

    expect(screen.queryByText("Compound name")).not.toBeInTheDocument();
    expect(screen.getByText(/not the molecule's 3D shape or bond angles/)).toBeInTheDocument();
  });

  it("can be operated from the keyboard", async () => {
    const user = userEvent.setup();
    render(<CovalentBondExplorer />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Hydrogen gas, H2" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Hydrogen fluoride, HF" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Hydrogen fluoride, HF" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hydrogen gas, H2" })).toHaveAttribute("aria-pressed", "false");
    expect(detailRow("Lone pairs")).toHaveTextContent("3(3 on fluorine)");
  });
});
