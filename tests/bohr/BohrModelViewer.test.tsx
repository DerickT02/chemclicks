// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import BohrModelViewer from "@/components/bohr-models/BohrModelViewer";
import { BOHR_ION_INFO } from "@/lib/chemistry/bohr-ions";
import { ELEMENTS } from "@/lib/chemistry/elements";

afterEach(cleanup);

describe("Bohr atom builder", () => {
  it("changes element and resets electrons to neutral when protons change", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);

    await user.click(screen.getByRole("button", { name: "Add a proton" }));
    expect(screen.getByText("Helium")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Electrons" })).toHaveTextContent("2 electrons");
    expect(screen.getByRole("combobox", { name: "Electrons" })).toBeDisabled();
    expect(screen.getByRole("img", { name: /Bohr model for He \(atomic number 2\): 2 protons, 2 electrons, ionic charge 0 \(neutral\); Noble-gas stable/ })).toBeInTheDocument();
    expect(screen.getByText("Outer-shell stability: Noble-gas stable (neutral atom)")).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: 0 (neutral)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Helium, He" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Remove a proton" }));
    expect(screen.getByText("Hydrogen")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Electrons" })).toHaveTextContent("1 electron");
    expect(screen.getByText("Outer-shell stability: duet rule not met")).toBeInTheDocument();
  });

  it("shows documented hydrogen ions and resets to neutral on changing protons", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);
    const electrons = screen.getByRole("combobox", { name: "Electrons" });

    await user.click(electrons);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await user.click(screen.getByRole("option", { name: /Hydride \(H−\)/ }));
    expect(screen.getByText(/Hydride \(H−\): H− occurs in ionic metal hydrides/)).toBeInTheDocument();
    expect(screen.getByText("Total electrons").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByLabelText("Ionic charge: −1 (anion)")).toBeInTheDocument();
    expect(screen.getByText("Outer-shell stability: duet rule met (ion)")).toBeInTheDocument();
    expect(screen.getByText(/This electron arrangement does not prove the ion is stable on its own/)).toBeInTheDocument();

    await user.click(electrons);
    await user.click(screen.getByRole("option", { name: /Proton \(H\+\)/ }));
    expect(screen.getByText(/Proton \(H\+\): H\+ has no electrons/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Bohr model for H \(atomic number 1\): 1 proton, 0 electrons, ionic charge \+1 \(cation\); duet rule not met/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: +1 (cation)")).toBeInTheDocument();
    expect(screen.getByText("Occupied shells").nextElementSibling).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: "Calcium, Ca" }));
    expect(electrons).toHaveTextContent("20 electrons");
    expect(screen.getByLabelText("Ionic charge: 0 (neutral)")).toBeInTheDocument();
    expect(screen.getByText("Outer-shell stability: octet rule not met")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a proton" })).toBeDisabled();
    await user.click(electrons);
    await user.click(screen.getByRole("option", { name: /Calcium ion \(Ca2\+\)/ }));
    expect(screen.getByText(/Calcium ion \(Ca2\+\): Ca2\+ occurs in compounds/)).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: +2 (cation)")).toBeInTheDocument();
    expect(screen.getByText("Outer-shell stability: octet rule met (ion)")).toBeInTheDocument();
  });

  it("explains carbon bonding without calling it unstable", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);

    await user.click(screen.getByRole("button", { name: "Carbon, C" }));
    expect(screen.getByText(/Carbon usually shares electrons in covalent bonds/)).toBeInTheDocument();
    expect(screen.getByText("Outer-shell stability: octet rule not met")).toBeInTheDocument();
    expect(screen.queryByText(/Not a noble-gas configuration/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Electrons" }));
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.click(screen.getByRole("option", { name: /Carbide \(C4−\)/ }));
    expect(screen.getByText(/Carbide \(C4−\): C4− is found in some carbides; it is not stable as an isolated ion/)).toBeInTheDocument();
    expect(screen.getByText("Total electrons").nextElementSibling).toHaveTextContent("10");
    expect(screen.getByLabelText("Ionic charge: −4 (anion)")).toBeInTheDocument();
    expect(screen.getByText("Outer-shell stability: octet rule met (ion)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Calcium, Ca" }));
    expect(screen.getByText("Shell 3 · capacity 18e⁻")).toBeInTheDocument();
    expect(screen.getByText("Shell 4 · capacity 32e⁻")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sodium, Na" }));
    await user.click(screen.getByRole("combobox", { name: "Electrons" }));
    await user.click(screen.getByRole("option", { name: /Sodium ion \(Na\+\)/ }));
    expect(screen.getByText(/Sodium ion \(Na\+\): Na\+ occurs in ionic compounds/)).toBeInTheDocument();
    expect(screen.getByText("Total electrons").nextElementSibling).toHaveTextContent("10");
    expect(screen.getByLabelText("Ionic charge: +1 (cation)")).toBeInTheDocument();
    expect(screen.getByText("Outer-shell stability: octet rule met (ion)")).toBeInTheDocument();
  });

  it("only offers documented ion electron counts for all 20 elements", () => {
    const expectedCharges: Record<number, number[]> = {
      1: [1, -1], 2: [], 3: [1], 4: [2], 5: [],
      6: [-4], 7: [-3], 8: [-2], 9: [-1], 10: [],
      11: [1], 12: [2], 13: [3], 14: [-4], 15: [-3],
      16: [-2], 17: [-1], 18: [], 19: [1], 20: [2],
    };
    expect(Object.keys(BOHR_ION_INFO)).toHaveLength(ELEMENTS.length);
    for (const element of ELEMENTS) {
      const ions = BOHR_ION_INFO[element.atomicNumber].ions;
      expect(ions.map((ion) => ion.charge)).toEqual(expectedCharges[element.atomicNumber]);
      const counts = ions.map((ion) => element.atomicNumber - ion.charge);
      expect(new Set(counts).size).toBe(counts.length);
      expect(counts.every((count) => count >= 0 && count <= 20 && count !== element.atomicNumber)).toBe(true);
    }
  });
});
