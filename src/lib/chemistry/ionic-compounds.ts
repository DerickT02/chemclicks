import { ELEMENTS, type Element } from "@/lib/chemistry/elements";

export type Ion = {
  symbol: string;
  elementName: string;
  ionName: string;
  /** Signed charge of a single ion, e.g. +1 for Na⁺ or -2 for O²⁻. */
  charge: number;
  /** Number of these ions in one formula unit. */
  count: number;
  /** Valence electrons of the neutral atom before any transfer. */
  valenceElectrons: number;
};

export type IonicCompound = {
  id: string;
  name: string;
  /** Formula with subscript digits, e.g. CaF₂. */
  formula: string;
  /** Formula with plain digits, e.g. CaF2. */
  plainFormula: string;
  cation: Ion;
  anion: Ion;
};

type SaltDefinition = {
  cation: string;
  anion: string;
  anionName: string;
};

const SALT_DEFINITIONS: readonly SaltDefinition[] = [
  { cation: "Na", anion: "Cl", anionName: "chloride" },
  { cation: "Mg", anion: "O", anionName: "oxide" },
  { cation: "Ca", anion: "F", anionName: "fluoride" },
  { cation: "Al", anion: "O", anionName: "oxide" },
];

const OCTET = 8;
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const MINUS_SIGN = "−";

function getElement(symbol: string): Element {
  const element = ELEMENTS.find((item) => item.symbol === symbol);
  if (!element) {
    throw new Error(`Unknown element symbol: ${symbol}`);
  }
  return element;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

function leastCommonMultiple(a: number, b: number): number {
  return (a * b) / greatestCommonDivisor(a, b);
}

function toScript(value: number, digits: string): string {
  return String(value)
    .split("")
    .map((digit) => digits[Number(digit)])
    .join("");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function electronWord(count: number): string {
  return count === 1 ? "electron" : "electrons";
}

function buildCompound(definition: SaltDefinition): IonicCompound {
  const cationElement = getElement(definition.cation);
  const anionElement = getElement(definition.anion);

  // A metal loses all its valence electrons; a nonmetal gains enough to reach 8.
  const cationCharge = cationElement.valenceElectrons;
  const anionCharge = anionElement.valenceElectrons - OCTET;

  const smallestBalancedCharge = leastCommonMultiple(cationCharge, -anionCharge);
  const cationCount = smallestBalancedCharge / cationCharge;
  const anionCount = smallestBalancedCharge / -anionCharge;

  const cation: Ion = {
    symbol: cationElement.symbol,
    elementName: cationElement.name,
    ionName: cationElement.name,
    charge: cationCharge,
    count: cationCount,
    valenceElectrons: cationElement.valenceElectrons,
  };
  const anion: Ion = {
    symbol: anionElement.symbol,
    elementName: anionElement.name,
    ionName: capitalize(definition.anionName),
    charge: anionCharge,
    count: anionCount,
    valenceElectrons: anionElement.valenceElectrons,
  };

  const formula = `${cation.symbol}${cationCount > 1 ? toScript(cationCount, SUBSCRIPT_DIGITS) : ""}${anion.symbol}${anionCount > 1 ? toScript(anionCount, SUBSCRIPT_DIGITS) : ""}`;
  const plainFormula = `${cation.symbol}${cationCount > 1 ? cationCount : ""}${anion.symbol}${anionCount > 1 ? anionCount : ""}`;

  return {
    id: plainFormula.toLowerCase(),
    name: `${cation.elementName} ${definition.anionName}`,
    formula,
    plainFormula,
    cation,
    anion,
  };
}

export const IONIC_COMPOUNDS: readonly IonicCompound[] = SALT_DEFINITIONS.map(buildCompound);

/** Superscript charge, e.g. "⁺", "³⁺", "²⁻". */
export function formatCharge(charge: number): string {
  const sign = charge > 0 ? "⁺" : "⁻";
  const magnitude = Math.abs(charge);
  return `${magnitude > 1 ? toScript(magnitude, SUPERSCRIPT_DIGITS) : ""}${sign}`;
}

/** Ion symbol with superscript charge, e.g. "Na⁺" or "O²⁻". */
export function formatIonSymbol(ion: Ion): string {
  return `${ion.symbol}${formatCharge(ion.charge)}`;
}

/** Explicit signed charge text, e.g. "+1" or "−2". */
export function formatChargeValue(charge: number): string {
  return `${charge > 0 ? "+" : MINUS_SIGN}${Math.abs(charge)}`;
}

/** Screen-reader text for an ion symbol, e.g. "sodium ion, charge plus 1". */
export function describeIon(ion: Ion): string {
  const sign = ion.charge > 0 ? "plus" : "minus";
  return `${ion.ionName.toLowerCase()} ion, charge ${sign} ${Math.abs(ion.charge)}`;
}

/** Cation-to-anion count ratio, e.g. "2:3". */
export function getAtomRatio(compound: IonicCompound): string {
  return `${compound.cation.count}:${compound.anion.count}`;
}

export function getNetCharge(compound: IonicCompound): number {
  return (
    compound.cation.count * compound.cation.charge +
    compound.anion.count * compound.anion.charge
  );
}

export function isChargeBalanced(compound: IonicCompound): boolean {
  return getNetCharge(compound) === 0;
}

/** Electrons moved from the cations to the anions per formula unit. */
export function getTransferredElectrons(compound: IonicCompound): number {
  return compound.cation.count * compound.cation.charge;
}

export function describeChargeBalance(compound: IonicCompound): string {
  const { cation, anion } = compound;
  return `${cation.count} × (${formatChargeValue(cation.charge)}) + ${anion.count} × (${formatChargeValue(anion.charge)}) = ${getNetCharge(compound)}`;
}

export function describeFormation(compound: IonicCompound): string {
  const { cation, anion } = compound;
  const cationLoss = cation.charge;
  const anionGain = -anion.charge;
  const total = getTransferredElectrons(compound);

  return [
    `${compound.name} (${compound.formula}) forms when electrons transfer from the metal to the nonmetal.`,
    `Each ${cation.elementName.toLowerCase()} atom gives up ${cationLoss} ${electronWord(cationLoss)} and becomes ${formatIonSymbol(cation)}.`,
    `Each ${anion.elementName.toLowerCase()} atom gains ${anionGain} ${electronWord(anionGain)} and becomes ${formatIonSymbol(anion)}.`,
    `${total} ${electronWord(total)} ${total === 1 ? "moves" : "move"} in total, so ${cation.count} ${formatIonSymbol(cation)} and ${anion.count} ${formatIonSymbol(anion)} combine to give a net charge of 0.`,
  ].join(" ");
}
