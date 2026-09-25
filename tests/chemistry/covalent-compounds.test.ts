import { describe, expect, it } from "vitest";
import {
  COVALENT_BOND_GROUPS,
  COVALENT_COMPOUNDS,
  describeAtomElectronCount,
  describeAtoms,
  describeBondOrder,
  describeBonds,
  describeDiagram,
  describeElectronSource,
  describeLonePairs,
  describeShellOverlap,
  describeSharing,
  describeValenceBeforeBonding,
  getAlternatingAtomGroups,
  getAtom,
  getAtomElectronCount,
  getBondSide,
  getFullShellSize,
  getLonePairCount,
  getSharedPairCount,
  getUnpairedElectrons,
} from "@/lib/chemistry/covalent-compounds";
import { ELEMENTS } from "@/lib/chemistry/elements";

function compoundById(id: string) {
  const compound = COVALENT_COMPOUNDS.find((item) => item.id === id);
  if (!compound) throw new Error(`Missing compound ${id}`);
  return compound;
}

describe("covalent compound examples", () => {
  it("offers exactly H₂, O₂, N₂, HF, H₂O, CO₂, NH₃ and CH₄ in order", () => {
    expect(COVALENT_COMPOUNDS.map((compound) => compound.formula)).toEqual([
      "H₂", "O₂", "N₂", "HF", "H₂O", "CO₂", "NH₃", "CH₄",
    ]);
    expect(COVALENT_COMPOUNDS.map((compound) => compound.plainFormula)).toEqual([
      "H2", "O2", "N2", "HF", "H2O", "CO2", "NH3", "CH4",
    ]);
    expect(COVALENT_COMPOUNDS.map((compound) => compound.name)).toEqual([
      "Hydrogen gas", "Oxygen gas", "Nitrogen gas", "Hydrogen fluoride", "Water", "Carbon dioxide", "Ammonia", "Methane",
    ]);
  });

  it("groups every compound once by its bond type", () => {
    expect(
      COVALENT_BOND_GROUPS.map((group) => [group.label, group.compounds.map((compound) => compound.formula)]),
    ).toEqual([
      ["Single bonds", ["H₂", "HF", "H₂O", "NH₃", "CH₄"]],
      ["Double bonds", ["O₂", "CO₂"]],
      ["Triple bonds", ["N₂"]],
    ]);
  });

  it.each([
    ["h2", 1, 0, "single", "1 single bond", "2 hydrogen", "None"],
    ["o2", 2, 4, "double", "1 double bond", "2 oxygen", "2 on each oxygen"],
    ["n2", 3, 2, "triple", "1 triple bond", "2 nitrogen", "1 on each nitrogen"],
    ["hf", 1, 3, "single", "1 single bond", "1 hydrogen, 1 fluorine", "3 on fluorine"],
    ["h2o", 2, 2, "single", "2 single bonds", "2 hydrogen, 1 oxygen", "2 on oxygen"],
    ["co2", 4, 4, "double", "2 double bonds", "1 carbon, 2 oxygen", "2 on each oxygen"],
    ["nh3", 3, 1, "single", "3 single bonds", "1 nitrogen, 3 hydrogen", "1 on nitrogen"],
    ["ch4", 4, 0, "single", "4 single bonds", "1 carbon, 4 hydrogen", "None"],
  ])("%s has %i shared and %i lone pairs", (id, shared, lone, bondType, bonds, atoms, lonePairs) => {
    const compound = compoundById(id);
    expect(getSharedPairCount(compound)).toBe(shared);
    expect(getLonePairCount(compound)).toBe(lone);
    expect(compound.bondType).toBe(bondType);
    expect(describeBonds(compound)).toBe(bonds);
    expect(describeAtoms(compound)).toBe(atoms);
    expect(describeLonePairs(compound)).toBe(lonePairs);
  });

  describe.each(COVALENT_COMPOUNDS.map((compound) => [compound.formula, compound] as const))(
    "%s",
    (_formula, compound) => {
      it("gives every atom a full outer shell (a duet for hydrogen, an octet otherwise)", () => {
        for (const atom of compound.atoms) {
          expect(getAtomElectronCount(compound, atom.id)).toBe(atom.symbol === "H" ? 2 : 8);
        }
      });

      it("shows exactly the valence electrons of its atoms", () => {
        const valence = compound.atoms.reduce((total, atom) => {
          const element = ELEMENTS.find((item) => item.symbol === atom.symbol);
          return total + (element?.valenceElectrons ?? Number.NaN);
        }, 0);
        expect(2 * (getSharedPairCount(compound) + getLonePairCount(compound))).toBe(valence);
      });

      it("only bonds atoms that sit next to each other, with no lone pair on a bonded side", () => {
        for (const bond of compound.bonds) {
          const from = getAtom(compound, bond.from);
          const to = getAtom(compound, bond.to);
          expect(from.lonePairSides).not.toContain(getBondSide(from, to));
          expect(to.lonePairSides).not.toContain(getBondSide(to, from));
        }
      });

      it("puts each atom in its own grid cell and never repeats a lone-pair side", () => {
        const cells = compound.atoms.map((atom) => `${atom.x},${atom.y}`);
        expect(new Set(cells).size).toBe(cells.length);
        for (const atom of compound.atoms) {
          expect(new Set(atom.lonePairSides).size).toBe(atom.lonePairSides.length);
        }
      });
    },
  );
});

describe("bond descriptions", () => {
  it("names the bond order with its shared pairs and electrons", () => {
    expect(describeBondOrder(1)).toBe("Single bond — 1 shared pair (2 electrons)");
    expect(describeBondOrder(2)).toBe("Double bond — 2 shared pairs (4 electrons)");
    expect(describeBondOrder(3)).toBe("Triple bond — 3 shared pairs (6 electrons)");
  });

  it("rejects bonds between atoms that are not next to each other", () => {
    const methane = compoundById("ch4");
    expect(() => getBondSide(getAtom(methane, "h1"), getAtom(methane, "h3"))).toThrow(/not next to each other/);
  });

  it("describes the diagram for screen readers", () => {
    expect(describeDiagram(compoundById("h2"))).toBe(
      "Diagram of hydrogen gas: 1 single bond between the two hydrogen atoms (1 shared pair); no lone pairs.",
    );
    expect(describeDiagram(compoundById("co2"))).toBe(
      "Diagram of carbon dioxide: 2 double bonds between carbon and oxygen (2 shared pairs each); lone pairs: 2 on each oxygen.",
    );
    expect(describeDiagram(compoundById("n2"))).toBe(
      "Diagram of nitrogen gas: 1 triple bond between the two nitrogen atoms (3 shared pairs); lone pairs: 1 on each nitrogen.",
    );
  });

  it("explains how the electrons are shared", () => {
    expect(describeSharing(compoundById("h2o"))).toBe(
      "Water (H₂O) is held together by 2 single bonds. In a single bond, two atoms share 1 pair of electrons. " +
        "The molecule shares 2 pairs of electrons (4 electrons) in total. " +
        "The oxygen also keeps 2 lone pairs that are not shared. " +
        "Counting shared and lone electrons, each hydrogen has 2 and the oxygen has 8, so every atom has a full outer shell.",
    );
  });
});

describe("step-by-step sharing", () => {
  it("gives every atom one unpaired electron per shared pair, on free sides only", () => {
    for (const compound of COVALENT_COMPOUNDS) {
      for (const atom of compound.atoms) {
        const unpaired = getUnpairedElectrons(compound, atom.id);
        const sides = unpaired.map((electron) => electron.side);

        expect(unpaired).toHaveLength(atom.valenceElectrons - 2 * atom.lonePairSides.length);
        expect(unpaired).toHaveLength(getAtomElectronCount(compound, atom.id) / 2 - atom.lonePairSides.length);
        expect(new Set(sides).size).toBe(sides.length);
        expect(sides.filter((side) => atom.lonePairSides.includes(side))).toEqual([]);
      }
    }
  });

  it("puts the first electron of each bond on the side facing the partner atom", () => {
    const nitrogen = compoundById("n2");
    expect(getUnpairedElectrons(nitrogen, "n1")).toEqual([
      { bondId: "n1-n2", pair: 0, side: "right" },
      { bondId: "n1-n2", pair: 1, side: "top" },
      { bondId: "n1-n2", pair: 2, side: "bottom" },
    ]);
    expect(getUnpairedElectrons(compoundById("h2o"), "o")).toEqual([
      { bondId: "o-h1", pair: 0, side: "left" },
      { bondId: "o-h2", pair: 0, side: "bottom" },
    ]);
  });

  it("colours bonded atoms differently so each shared pair shows one electron from each", () => {
    for (const compound of COVALENT_COMPOUNDS) {
      const groups = getAlternatingAtomGroups(compound);
      expect(Object.keys(groups).sort()).toEqual(compound.atoms.map((atom) => atom.id).sort());
      for (const bond of compound.bonds) {
        expect(groups[bond.from]).not.toBe(groups[bond.to]);
      }
    }
    expect(getAlternatingAtomGroups(compoundById("ch4"))).toEqual({ c: 0, h1: 1, h2: 1, h3: 1, h4: 1 });
  });

  it("labels where each colour of electron came from", () => {
    expect(describeElectronSource(compoundById("h2o"), 0)).toBe("From the oxygen");
    expect(describeElectronSource(compoundById("h2o"), 1)).toBe("From the hydrogens");
    expect(describeElectronSource(compoundById("n2"), 0)).toBe("From the left nitrogen");
    expect(describeElectronSource(compoundById("n2"), 1)).toBe("From the right nitrogen");
  });

  it("describes each step", () => {
    expect(describeValenceBeforeBonding(compoundById("h2o"))).toBe(
      "Each hydrogen brings 1 valence electron: 1 unpaired electron. " +
        "The oxygen brings 6 valence electrons: 2 unpaired electrons and 2 pairs it keeps. " +
        "The unpaired electrons are the ones that get shared.",
    );
    expect(describeShellOverlap(compoundById("co2"))).toBe(
      "The atoms move close enough for their outer shells to overlap. " +
        "Each unpaired electron teams up with one from the neighbouring atom, and the pair sits in the overlap, so both atoms count it. " +
        "Carbon dioxide has 4 shared pairs in all.",
    );
  });

  it("counts a full outer shell for every atom", () => {
    for (const compound of COVALENT_COMPOUNDS) {
      for (const atom of compound.atoms) {
        expect(getAtomElectronCount(compound, atom.id)).toBe(getFullShellSize(atom));
      }
    }
    expect(describeAtomElectronCount(compoundById("h2o"), "o")).toBe(
      "This oxygen counts 4 in lone pairs + 4 shared = 8 electrons, a full outer shell (an octet).",
    );
    expect(describeAtomElectronCount(compoundById("h2o"), "h1")).toBe(
      "This hydrogen counts 2 shared = 2 electrons, a full outer shell for hydrogen.",
    );
  });
});
