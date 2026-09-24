/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../quiz/setup";
import IonicCompoundExplorer from "@/components/lewis/IonicCompoundExplorer";

afterEach(cleanup);

const SALTS = [
  { button: "Sodium chloride, NaCl", name: "Sodium chloride", cation: "sodium ion, charge plus 1", anion: "chloride ion, charge minus 1", ratio: "Na : Cl = 1 : 1" },
  { button: "Magnesium oxide, MgO", name: "Magnesium oxide", cation: "magnesium ion, charge plus 2", anion: "oxide ion, charge minus 2", ratio: "Mg : O = 1 : 1" },
  { button: "Calcium fluoride, CaF2", name: "Calcium fluoride", cation: "calcium ion, charge plus 2", anion: "fluoride ion, charge minus 1", ratio: "Ca : F = 1 : 2" },
  { button: "Aluminum oxide, Al2O3", name: "Aluminum oxide", cation: "aluminum ion, charge plus 3", anion: "oxide ion, charge minus 2", ratio: "Al : O = 2 : 3" },
] as const;

function details() {
  return screen.getByText("Compound name").closest("dl") as HTMLElement;
}

function detailRow(label: string) {
  return screen.getByText(label, { selector: "dt" }).parentElement as HTMLElement;
}

describe("IonicCompoundExplorer", () => {
  it("offers all four salts as named buttons, with the first selected", () => {
    render(<IonicCompoundExplorer />);
    const group = screen.getByRole("group", { name: "Choose an example salt" });

    for (const salt of SALTS) {
      expect(within(group).getByRole("button", { name: salt.button })).toBeInTheDocument();
    }
    expect(within(group).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: SALTS[0].button })).toHaveAttribute("aria-pressed", "true");
  });

  it.each(SALTS)("shows matching details for $name", async (salt) => {
    const user = userEvent.setup();
    render(<IonicCompoundExplorer />);

    await user.click(screen.getByRole("button", { name: salt.button }));

    expect(screen.getByRole("button", { name: salt.button })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    const table = within(details());
    expect(table.getByText(salt.name)).toBeInTheDocument();
    expect(table.getByText(salt.cation)).toBeInTheDocument();
    expect(table.getByText(salt.anion)).toBeInTheDocument();
    expect(table.getByText(salt.ratio)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: new RegExp(`Diagram of ${salt.name}`, "i") })).toBeInTheDocument();
  });

  it("replaces every dependent piece of content together when switching", async () => {
    const user = userEvent.setup();
    render(<IonicCompoundExplorer />);

    await user.click(screen.getByRole("button", { name: "Aluminum oxide, Al2O3" }));
    const aluminumText = screen.getByText(/Aluminum oxide \(Al₂O₃\) forms/);
    expect(aluminumText).toHaveTextContent("Al³⁺");
    expect(aluminumText).toHaveTextContent("O²⁻");
    expect(within(details()).getByText("2 × (+3) + 3 × (−2) = 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sodium chloride, NaCl" }));

    const caption = screen.getByText(/Sodium chloride \(NaCl\) forms/);
    expect(caption).toHaveTextContent("Na⁺");
    expect(caption).toHaveTextContent("Cl⁻");
    // The selector always lists every formula, so check only the dependent content.
    const dependent = [details(), screen.getByRole("figure")];
    for (const region of dependent) {
      expect(region).not.toHaveTextContent("Al³⁺");
      expect(region).not.toHaveTextContent("O²⁻");
      expect(region).not.toHaveTextContent("Aluminum");
      expect(region).not.toHaveTextContent("Al₂O₃");
    }
    expect(screen.queryByText(/aluminum ion/)).not.toBeInTheDocument();
    expect(within(details()).getByText("1 × (+1) + 1 × (−1) = 0")).toBeInTheDocument();
  });

  it("shows ion counts and explicit charges for a multivalent compound", async () => {
    const user = userEvent.setup();
    render(<IonicCompoundExplorer />);

    await user.click(screen.getByRole("button", { name: "Aluminum oxide, Al2O3" }));

    expect(detailRow("Cation")).toHaveTextContent("Al³⁺");
    expect(detailRow("Cation")).toHaveTextContent("Aluminum ion, charge +3, count 2");
    expect(detailRow("Anion")).toHaveTextContent("O²⁻");
    expect(detailRow("Anion")).toHaveTextContent("Oxide ion, charge −2, count 3");
    expect(screen.getByText("× 2 in each formula unit")).toBeInTheDocument();
    expect(screen.getByText("× 3 in each formula unit")).toBeInTheDocument();
  });

  it("gives the diagram a grammatical text alternative for one and several electrons", async () => {
    const user = userEvent.setup();
    render(<IonicCompoundExplorer />);

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Diagram of sodium chloride: 1 electron moves from sodium to chlorine. Result: sodium ion, charge plus 1; chloride ion, charge minus 1.",
    );

    await user.click(screen.getByRole("button", { name: "Aluminum oxide, Al2O3" }));
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Diagram of aluminum oxide: 6 electrons move from aluminum to oxygen. Result: aluminum ion, charge plus 3; oxide ion, charge minus 2.",
    );
  });

  it("explains the diagram colors in text, not color alone", () => {
    render(<IonicCompoundExplorer />);

    const figure = within(screen.getByRole("figure"));
    expect(figure.getByText("Valence electron (e⁻)")).toBeInTheDocument();
    expect(figure.getByText("Electron gained")).toBeInTheDocument();
    expect(figure.getByText("Gains 1 electron per atom")).toBeInTheDocument();
  });

  it("can be operated from the keyboard", async () => {
    const user = userEvent.setup();
    render(<IonicCompoundExplorer />);

    await user.tab();
    expect(screen.getByRole("button", { name: SALTS[0].button })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: SALTS[1].button })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: SALTS[1].button })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: SALTS[0].button })).toHaveAttribute("aria-pressed", "false");

    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: SALTS[2].button })).toHaveAttribute("aria-pressed", "true");
  });
});
