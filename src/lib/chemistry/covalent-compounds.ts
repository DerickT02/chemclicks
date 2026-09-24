import { ELEMENTS, type Element } from "@/lib/chemistry/elements";
import { SUBSCRIPT_DIGITS } from "@/lib/chemistry/ionic-compounds";

export type BondOrder = 1 | 2 | 3;

export type BondType = "single" | "double" | "triple";

export type Side = "top" | "right" | "bottom" | "left";

export type CovalentAtom = {
  id: string;
  symbol: string;
  elementName: string;
  valenceElectrons: number;
  /** Column on the diagram grid; bonded atoms are always one cell apart. */
  x: number;
  /** Row on the diagram grid. */
  y: number;
  /** Sides of the atom that carry an unshared (lone) electron pair. */
  lonePairSides: readonly Side[];
};

export type CovalentBond = {
  id: string;
  from: string;
  to: string;
  /** Number of electron pairs shared by the two atoms. */
  order: BondOrder;
};

export type CovalentCompound = {
  id: string;
  name: string;
  /** Formula with subscript digits, e.g. H₂O. */
  formula: string;
  /** Formula with plain digits, e.g. H2O. */
  plainFormula: string;
  /** Atoms listed in formula order. */
  atoms: readonly CovalentAtom[];
  bonds: readonly CovalentBond[];
  /** Highest bond order in the molecule, which decides its group in the selector. */
  bondOrder: BondOrder;
  bondType: BondType;
};

export type CovalentBondGroup = {
  bondType: BondType;
  order: BondOrder;
  label: string;
  compounds: readonly CovalentCompound[];
};

type AtomDefinition = {
  id: string;
  symbol: string;
  x: number;
  y: number;
  lonePairSides?: readonly Side[];
};

type CompoundDefinition = {
  name: string;
  /** Listed in formula order, e.g. carbon before oxygen for CO₂. */
  atoms: readonly AtomDefinition[];
  bonds: readonly { from: string; to: string; order: BondOrder }[];
};

const COMPOUND_DEFINITIONS: readonly CompoundDefinition[] = [
  {
    name: "Hydrogen gas",
    atoms: [
      { id: "h1", symbol: "H", x: 0, y: 0 },
      { id: "h2", symbol: "H", x: 1, y: 0 },
    ],
    bonds: [{ from: "h1", to: "h2", order: 1 }],
  },
  {
    name: "Oxygen gas",
    atoms: [
      { id: "o1", symbol: "O", x: 0, y: 0, lonePairSides: ["top", "bottom"] },
      { id: "o2", symbol: "O", x: 1, y: 0, lonePairSides: ["top", "bottom"] },
    ],
    bonds: [{ from: "o1", to: "o2", order: 2 }],
  },
  {
    name: "Nitrogen gas",
    atoms: [
      { id: "n1", symbol: "N", x: 0, y: 0, lonePairSides: ["left"] },
      { id: "n2", symbol: "N", x: 1, y: 0, lonePairSides: ["right"] },
    ],
    bonds: [{ from: "n1", to: "n2", order: 3 }],
  },
  {
    name: "Hydrogen fluoride",
    atoms: [
      { id: "h", symbol: "H", x: 0, y: 0 },
      { id: "f", symbol: "F", x: 1, y: 0, lonePairSides: ["top", "right", "bottom"] },
    ],
    bonds: [{ from: "h", to: "f", order: 1 }],
  },
  {
    name: "Water",
    // Drawn bent, not in a straight line, so the diagram doesn't suggest a linear molecule.
    atoms: [
      { id: "h1", symbol: "H", x: 0, y: 0 },
      { id: "h2", symbol: "H", x: 1, y: 1 },
      { id: "o", symbol: "O", x: 1, y: 0, lonePairSides: ["top", "right"] },
    ],
    bonds: [
      { from: "o", to: "h1", order: 1 },
      { from: "o", to: "h2", order: 1 },
    ],
  },
  {
    name: "Carbon dioxide",
    atoms: [
      { id: "c", symbol: "C", x: 1, y: 0 },
      { id: "o1", symbol: "O", x: 0, y: 0, lonePairSides: ["top", "bottom"] },
      { id: "o2", symbol: "O", x: 2, y: 0, lonePairSides: ["top", "bottom"] },
    ],
    bonds: [
      { from: "c", to: "o1", order: 2 },
      { from: "c", to: "o2", order: 2 },
    ],
  },
  {
    name: "Ammonia",
    atoms: [
      { id: "n", symbol: "N", x: 1, y: 0, lonePairSides: ["top"] },
      { id: "h1", symbol: "H", x: 0, y: 0 },
      { id: "h2", symbol: "H", x: 2, y: 0 },
      { id: "h3", symbol: "H", x: 1, y: 1 },
    ],
    bonds: [
      { from: "n", to: "h1", order: 1 },
      { from: "n", to: "h2", order: 1 },
      { from: "n", to: "h3", order: 1 },
    ],
  },
  {
    name: "Methane",
    atoms: [
      { id: "c", symbol: "C", x: 1, y: 1 },
      { id: "h1", symbol: "H", x: 1, y: 0 },
      { id: "h2", symbol: "H", x: 2, y: 1 },
      { id: "h3", symbol: "H", x: 1, y: 2 },
      { id: "h4", symbol: "H", x: 0, y: 1 },
    ],
    bonds: [
      { from: "c", to: "h1", order: 1 },
      { from: "c", to: "h2", order: 1 },
      { from: "c", to: "h3", order: 1 },
      { from: "c", to: "h4", order: 1 },
    ],
  },
];

const BOND_TYPES: Record<BondOrder, BondType> = { 1: "single", 2: "double", 3: "triple" };

const BOND_ORDERS: readonly BondOrder[] = [1, 2, 3];

function getElement(symbol: string): Element {
  const element = ELEMENTS.find((item) => item.symbol === symbol);
  if (!element) {
    throw new Error(`Unknown element symbol: ${symbol}`);
  }
  return element;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function toSubscriptFormula(plainFormula: string): string {
  return plainFormula.replace(/\d/g, (digit) => SUBSCRIPT_DIGITS[Number(digit)]);
}

/** Element symbols in formula order with how many atoms of each, e.g. C×1, O×2. */
function countAtomsBySymbol(atoms: readonly CovalentAtom[]): { atom: CovalentAtom; count: number }[] {
  const counts: { atom: CovalentAtom; count: number }[] = [];
  for (const atom of atoms) {
    const entry = counts.find((item) => item.atom.symbol === atom.symbol);
    if (entry) {
      entry.count += 1;
    } else {
      counts.push({ atom, count: 1 });
    }
  }
  return counts;
}

function buildCompound(definition: CompoundDefinition): CovalentCompound {
  const atoms: CovalentAtom[] = definition.atoms.map((atom) => {
    const element = getElement(atom.symbol);
    return {
      id: atom.id,
      symbol: element.symbol,
      elementName: element.name,
      valenceElectrons: element.valenceElectrons,
      x: atom.x,
      y: atom.y,
      lonePairSides: atom.lonePairSides ?? [],
    };
  });

  const plainFormula = countAtomsBySymbol(atoms)
    .map(({ atom, count }) => `${atom.symbol}${count > 1 ? count : ""}`)
    .join("");
  const highestOrder = Math.max(...definition.bonds.map((bond) => bond.order)) as BondOrder;

  return {
    id: plainFormula.toLowerCase(),
    name: definition.name,
    formula: toSubscriptFormula(plainFormula),
    plainFormula,
    atoms,
    bonds: definition.bonds.map((bond) => ({ ...bond, id: `${bond.from}-${bond.to}` })),
    bondOrder: highestOrder,
    bondType: BOND_TYPES[highestOrder],
  };
}

export const COVALENT_COMPOUNDS: readonly CovalentCompound[] = COMPOUND_DEFINITIONS.map(buildCompound);

export const COVALENT_BOND_GROUPS: readonly CovalentBondGroup[] = BOND_ORDERS.map((order) => {
  const bondType = BOND_TYPES[order];
  return {
    bondType,
    order,
    label: `${capitalize(bondType)} bonds`,
    compounds: COVALENT_COMPOUNDS.filter((compound) => compound.bondOrder === order),
  };
});

export function getAtom(compound: CovalentCompound, atomId: string): CovalentAtom {
  const atom = compound.atoms.find((item) => item.id === atomId);
  if (!atom) {
    throw new Error(`Unknown atom ${atomId} in ${compound.plainFormula}`);
  }
  return atom;
}

/** The side of `atom` that faces `neighbor`; bonded atoms must be one grid cell apart. */
export function getBondSide(atom: CovalentAtom, neighbor: CovalentAtom): Side {
  const dx = neighbor.x - atom.x;
  const dy = neighbor.y - atom.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "bottom";
  if (dx === 0 && dy === -1) return "top";
  throw new Error(`Atoms ${atom.id} and ${neighbor.id} are not next to each other`);
}

/** Electron pairs shared across every bond in the molecule. */
export function getSharedPairCount(compound: CovalentCompound): number {
  return compound.bonds.reduce((total, bond) => total + bond.order, 0);
}

export function getLonePairCount(compound: CovalentCompound): number {
  return compound.atoms.reduce((total, atom) => total + atom.lonePairSides.length, 0);
}

/** Shared pairs in the bonds that touch one atom. */
export function getAtomSharedPairCount(compound: CovalentCompound, atomId: string): number {
  return compound.bonds
    .filter((bond) => bond.from === atomId || bond.to === atomId)
    .reduce((total, bond) => total + bond.order, 0);
}

/** Electrons around one atom, counting its lone pairs and every pair it shares. */
export function getAtomElectronCount(compound: CovalentCompound, atomId: string): number {
  const atom = getAtom(compound, atomId);
  return 2 * (atom.lonePairSides.length + getAtomSharedPairCount(compound, atomId));
}

/** e.g. "Double bond — 2 shared pairs (4 electrons)". */
export function describeBondOrder(order: BondOrder): string {
  return `${capitalize(BOND_TYPES[order])} bond — ${plural(order, "shared pair")} (${order * 2} electrons)`;
}

/** e.g. "1 carbon, 2 oxygen". */
export function describeAtoms(compound: CovalentCompound): string {
  return countAtomsBySymbol(compound.atoms)
    .map(({ atom, count }) => `${count} ${atom.elementName.toLowerCase()}`)
    .join(", ");
}

/** e.g. "2 double bonds" or "3 single bonds". */
export function describeBonds(compound: CovalentCompound): string {
  return BOND_ORDERS.map((order) => ({
    order,
    count: compound.bonds.filter((bond) => bond.order === order).length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ order, count }) => plural(count, `${BOND_TYPES[order]} bond`))
    .join(", ");
}

/** Where the lone pairs sit, e.g. "None", "3 on fluorine" or "2 on each oxygen". */
export function describeLonePairs(compound: CovalentCompound): string {
  const parts = countAtomsBySymbol(compound.atoms)
    .filter(({ atom }) => atom.lonePairSides.length > 0)
    .map(({ atom, count }) => {
      const element = atom.elementName.toLowerCase();
      return `${atom.lonePairSides.length} on ${count > 1 ? `each ${element}` : element}`;
    });
  return parts.length === 0 ? "None" : parts.join("; ");
}

/** Text alternative for the diagram, listing each kind of bond and the lone pairs. */
export function describeDiagram(compound: CovalentCompound): string {
  const bondParts = BOND_ORDERS.flatMap((order) => {
    const bonds = compound.bonds.filter((bond) => bond.order === order);
    if (bonds.length === 0) return [];
    const from = getAtom(compound, bonds[0].from).elementName.toLowerCase();
    const to = getAtom(compound, bonds[0].to).elementName.toLowerCase();
    const between = from === to ? `the two ${from} atoms` : `${from} and ${to}`;
    const pairs = bonds.length === 1 ? plural(order, "shared pair") : `${plural(order, "shared pair")} each`;
    return [`${plural(bonds.length, `${BOND_TYPES[order]} bond`)} between ${between} (${pairs})`];
  });
  const lonePairs = describeLonePairs(compound);
  const loneText = lonePairs === "None" ? "no lone pairs" : `lone pairs: ${lonePairs}`;
  return `Diagram of ${compound.name.toLowerCase()}: ${bondParts.join(", ")}; ${loneText}.`;
}

/** Plain-language explanation of how the electrons are shared. */
export function describeSharing(compound: CovalentCompound): string {
  const shared = getSharedPairCount(compound);
  const groups = countAtomsBySymbol(compound.atoms);
  const article = (count: number) => (count > 1 ? "Each" : "The");

  const bondSentences = BOND_ORDERS.filter((order) =>
    compound.bonds.some((bond) => bond.order === order),
  ).map((order) => `In a ${BOND_TYPES[order]} bond, two atoms share ${plural(order, "pair")} of electrons.`);

  const loneSentences = groups
    .filter(({ atom }) => atom.lonePairSides.length > 0)
    .map(
      ({ atom, count }) =>
        `${article(count)} ${atom.elementName.toLowerCase()} also keeps ${plural(atom.lonePairSides.length, "lone pair")} that ${atom.lonePairSides.length === 1 ? "is" : "are"} not shared.`,
    );

  const fullShells = groups
    .map(({ atom, count }) => {
      const electrons = getAtomElectronCount(compound, atom.id);
      return `${article(count).toLowerCase()} ${atom.elementName.toLowerCase()} has ${electrons}`;
    })
    .join(" and ");

  return [
    `${compound.name} (${compound.formula}) is held together by ${describeBonds(compound)}.`,
    ...bondSentences,
    `The molecule shares ${plural(shared, "pair")} of electrons (${shared * 2} electrons) in total.`,
    ...loneSentences,
    `Counting shared and lone electrons, ${fullShells}, so every atom has a full outer shell.`,
  ].join(" ");
}
