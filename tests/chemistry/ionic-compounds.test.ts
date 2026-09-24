import { describe, expect, it } from "vitest";
import {
  IONIC_COMPOUNDS,
  describeChargeBalance,
  describeFormation,
  describeIon,
  formatCharge,
  formatChargeValue,
  formatIonSymbol,
  getAtomRatio,
  getNetCharge,
  getTransferredElectrons,
  isChargeBalanced,
} from "@/lib/chemistry/ionic-compounds";

function compoundById(id: string) {
  const compound = IONIC_COMPOUNDS.find((item) => item.id === id);
  if (!compound) throw new Error(`Missing compound ${id}`);
  return compound;
}

describe("ionic compound examples", () => {
  it("offers exactly NaCl, MgO, CaF₂ and Al₂O₃ in order", () => {
    expect(IONIC_COMPOUNDS.map((compound) => compound.formula)).toEqual([
      "NaCl",
      "MgO",
      "CaF₂",
      "Al₂O₃",
    ]);
    expect(IONIC_COMPOUNDS.map((compound) => compound.name)).toEqual([
      "Sodium chloride",
      "Magnesium oxide",
      "Calcium fluoride",
      "Aluminum oxide",
    ]);
  });

  it.each([
    ["nacl", "Na", 1, 1, "Cl", -1, 1, "1:1"],
    ["mgo", "Mg", 2, 1, "O", -2, 1, "1:1"],
    ["caf2", "Ca", 2, 1, "F", -1, 2, "1:2"],
    ["al2o3", "Al", 3, 2, "O", -2, 3, "2:3"],
  ])(
    "%s has the right ions, charges and charge-balanced ratio",
    (id, cationSymbol, cationCharge, cationCount, anionSymbol, anionCharge, anionCount, ratio) => {
      const compound = compoundById(id);

      expect(compound.cation.symbol).toBe(cationSymbol);
      expect(compound.cation.charge).toBe(cationCharge);
      expect(compound.cation.count).toBe(cationCount);
      expect(compound.anion.symbol).toBe(anionSymbol);
      expect(compound.anion.charge).toBe(anionCharge);
      expect(compound.anion.count).toBe(anionCount);
      expect(getAtomRatio(compound)).toBe(ratio);
      expect(getNetCharge(compound)).toBe(0);
      expect(isChargeBalanced(compound)).toBe(true);
    },
  );

  it("counts the electrons transferred per formula unit", () => {
    expect(getTransferredElectrons(compoundById("nacl"))).toBe(1);
    expect(getTransferredElectrons(compoundById("mgo"))).toBe(2);
    expect(getTransferredElectrons(compoundById("caf2"))).toBe(2);
    expect(getTransferredElectrons(compoundById("al2o3"))).toBe(6);
  });
});

describe("ion formatting", () => {
  it("writes ion symbols with superscript charges", () => {
    expect(formatIonSymbol(compoundById("nacl").cation)).toBe("Na⁺");
    expect(formatIonSymbol(compoundById("nacl").anion)).toBe("Cl⁻");
    expect(formatIonSymbol(compoundById("al2o3").cation)).toBe("Al³⁺");
    expect(formatIonSymbol(compoundById("al2o3").anion)).toBe("O²⁻");
  });

  it("formats charges as superscripts and as explicit signed text", () => {
    expect(formatCharge(1)).toBe("⁺");
    expect(formatCharge(-2)).toBe("²⁻");
    expect(formatChargeValue(3)).toBe("+3");
    expect(formatChargeValue(-1)).toBe("−1");
  });

  it("gives screen readers a text alternative for each ion", () => {
    expect(describeIon(compoundById("nacl").cation)).toBe("sodium ion, charge plus 1");
    expect(describeIon(compoundById("nacl").anion)).toBe("chloride ion, charge minus 1");
    expect(describeIon(compoundById("al2o3").cation)).toBe("aluminum ion, charge plus 3");
    expect(describeIon(compoundById("al2o3").anion)).toBe("oxide ion, charge minus 2");
  });
});

describe("explanations", () => {
  it("shows the charge arithmetic for multivalent compounds", () => {
    expect(describeChargeBalance(compoundById("al2o3"))).toBe("2 × (+3) + 3 × (−2) = 0");
    expect(describeChargeBalance(compoundById("nacl"))).toBe("1 × (+1) + 1 × (−1) = 0");
  });

  it("explains how the selected ions combine, without another salt's details", () => {
    const text = describeFormation(compoundById("al2o3"));

    expect(text).toContain("Aluminum oxide (Al₂O₃)");
    expect(text).toContain("gives up 3 electrons and becomes Al³⁺");
    expect(text).toContain("gains 2 electrons and becomes O²⁻");
    expect(text).toContain("6 electrons move in total");
    expect(text).not.toContain("Na⁺");
    expect(text).not.toContain("Cl⁻");
  });

  it("uses grammatical wording for one electron versus several", () => {
    expect(describeFormation(compoundById("nacl"))).toContain("1 electron moves in total");
    expect(describeFormation(compoundById("mgo"))).toContain("2 electrons move in total");
  });
});
