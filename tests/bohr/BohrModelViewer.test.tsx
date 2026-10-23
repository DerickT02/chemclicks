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
  it("keeps electrons when protons change and keeps protons when electrons change", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);

    expect(screen.getByLabelText("Protons: 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Electrons: 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a proton" }));
    expect(screen.getByText("Helium")).toBeInTheDocument();
    expect(screen.getByLabelText("Protons: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Electrons: 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: +1 (cation)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hydrogen, H, reset target" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Helium, He, protons in this model" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add an electron" }));
    expect(screen.getByLabelText("Protons: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Electrons: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: 0 (neutral)")).toBeInTheDocument();
    expect(screen.getByText("Noble-gas electron stability: met")).toBeInTheDocument();
  });

  it("selecting an element resets both counts to neutral for that element", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);

    await user.click(screen.getByRole("button", { name: "Add a proton" }));
    await user.click(screen.getByRole("button", { name: "Add an electron" }));
    await user.click(screen.getByRole("button", { name: "Calcium, Ca" }));

    expect(screen.getByLabelText("Protons: 20")).toBeInTheDocument();
    expect(screen.getByLabelText("Electrons: 20")).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: 0 (neutral)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calcium, Ca, reset target and protons in this model" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reset to neutral restores the selected element without reloading", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);

    await user.click(screen.getByRole("button", { name: "Sodium, Na" }));
    await user.click(screen.getByRole("button", { name: "Remove an electron" }));
    await user.click(screen.getByRole("button", { name: "Remove an electron" }));
    expect(screen.getByLabelText("Protons: 11")).toBeInTheDocument();
    expect(screen.getByLabelText("Electrons: 9")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Reset to neutral Sodium/ }));
    expect(screen.getByLabelText("Protons: 11")).toBeInTheDocument();
    expect(screen.getByLabelText("Electrons: 11")).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: 0 (neutral)")).toBeInTheDocument();
  });

  it("allows non-common-ion electron counts and shows documented ion notes when counts match", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);

    await user.click(screen.getByRole("button", { name: "Add an electron" }));
    expect(screen.getByRole("heading", { name: "Common ion example" })).toBeInTheDocument();
    expect(screen.getByText(/Hydride \(H−\): H− occurs in ionic metal hydrides/)).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: −1 (anion)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove an electron" }));
    await user.click(screen.getByRole("button", { name: "Remove an electron" }));
    expect(screen.getByText(/Proton \(H\+\): H\+ has no electrons/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Bohr model for H \(atomic number 1\): 1 proton, 0 electrons, ionic charge \+1 \(cation\)/ })).toBeInTheDocument();
    expect(screen.getByText("Occupied shells").nextElementSibling).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: "Carbon, C" }));
    await user.click(screen.getByRole("button", { name: "Add an electron" }));
    expect(screen.getByRole("heading", { name: "Exploration (not a listed common ion)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Electrons: 7")).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: −1 (anion)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sodium, Na" }));
    await user.click(screen.getByRole("button", { name: "Remove an electron" }));
    expect(screen.getByText(/Sodium ion \(Na\+\): Na\+ occurs in ionic compounds/)).toBeInTheDocument();
    expect(screen.getByLabelText("Electrons: 10")).toBeInTheDocument();
    expect(screen.getByLabelText("Ionic charge: +1 (cation)")).toBeInTheDocument();
  });

  it("explains carbon bonding and supports documented carbide counts", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);

    await user.click(screen.getByRole("button", { name: "Carbon, C" }));
    expect(screen.getByText(/Carbon usually shares electrons in covalent bonds/)).toBeInTheDocument();
    expect(screen.getByText(/Outer-shell rule \(duet\/octet\): octet rule not met/)).toBeInTheDocument();

    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole("button", { name: "Add an electron" }));
    }
    expect(screen.getByText(/Carbide \(C4−\): C4− is found in some carbides/)).toBeInTheDocument();
    expect(screen.getByText("Total electrons").nextElementSibling).toHaveTextContent("10");
    expect(screen.getByLabelText("Ionic charge: −4 (anion)")).toBeInTheDocument();
  });

  it("disables controls at supported proton and electron bounds", async () => {
    const user = userEvent.setup();
    render(<BohrModelViewer />);

    expect(screen.getByRole("button", { name: "Remove a proton" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remove an electron" }));
    expect(screen.getByLabelText("Electrons: 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove an electron" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Calcium, Ca" }));
    expect(screen.getByRole("button", { name: "Add a proton" })).toBeDisabled();
    for (let i = 0; i < 20; i++) {
      await user.click(screen.getByRole("button", { name: "Add an electron" }));
    }
    expect(screen.getByLabelText("Electrons: 20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add an electron" })).toBeDisabled();
  });

  it("documents expected ion charges for curriculum elements", () => {
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
