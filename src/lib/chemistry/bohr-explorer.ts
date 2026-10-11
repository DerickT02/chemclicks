import { ELEMENTS } from "@/lib/chemistry/elements";
import { getElectronShells } from "@/lib/chemistry/lewis";

const MAX_ELECTRONS = ELEMENTS.length;
const SHELL_NAMES = ["K", "L", "M", "N"] as const;

/** Noble-gas stable (NGS) electron counts for this curriculum (He, Ne, Ar). */
export const NOBLE_GAS_STABLE_ELECTRON_COUNTS = [2, 10, 18] as const;

export type StabilityIndicator = {
  met: boolean;
  label: string;
  explanation: string;
};

export function calculateIonicCharge(protons: number, electrons: number): number | null {
  if (
    !Number.isInteger(protons) || protons < 1 || protons > ELEMENTS.length ||
    !Number.isInteger(electrons) || electrons < 0 || electrons > MAX_ELECTRONS
  ) {
    return null;
  }
  return protons - electrons;
}

export function describeIonicCharge(charge: number): string {
  if (charge === 0) return "0 (neutral)";
  return charge > 0 ? `+${charge} (cation)` : `−${-charge} (anion)`;
}

export function isNobleGasStableElectronCount(electrons: number): boolean {
  if (!Number.isInteger(electrons) || electrons < 0 || electrons > MAX_ELECTRONS) {
    return false;
  }
  return (NOBLE_GAS_STABLE_ELECTRON_COUNTS as readonly number[]).includes(electrons);
}

export function describeNobleGasStability(electrons: number): StabilityIndicator {
  const met = isNobleGasStableElectronCount(electrons);
  return {
    met,
    label: met ? "NGS: met" : "NGS: not met",
    explanation: met
      ? `This particle has ${electrons} electrons, one of the noble-gas stable counts (2, 10, or 18).`
      : `NGS is met when an atom or ion has 2, 10, or 18 electrons total; this model has ${electrons}.`,
  };
}

export function isNeutralChargeStable(protons: number, electrons: number): boolean {
  return (
    Number.isInteger(protons) &&
    Number.isInteger(electrons) &&
    protons >= 1 &&
    protons <= ELEMENTS.length &&
    electrons >= 0 &&
    electrons <= MAX_ELECTRONS &&
    protons === electrons
  );
}

export function describeNeutralChargeStability(
  protons: number,
  electrons: number,
): StabilityIndicator {
  const met = isNeutralChargeStable(protons, electrons);
  return {
    met,
    label: met ? "NCS: met" : "NCS: not met",
    explanation: met
      ? "Protons equal electrons (neutral charge stability)."
      : `NCS is met when protons equal electrons; here ${protons} ${protons === 1 ? "proton" : "protons"} and ${electrons} ${electrons === 1 ? "electron" : "electrons"}.`,
  };
}

/** Protons minus electrons with signed result, e.g. "11 − 10 = +1". */
export function describeProtonElectronDifference(
  protons: number,
  electrons: number,
): string | null {
  const charge = calculateIonicCharge(protons, electrons);
  if (charge === null) return null;
  const magnitude =
    charge === 0 ? "0" : charge > 0 ? `+${charge}` : `−${Math.abs(charge)}`;
  return `${protons} − ${electrons} = ${magnitude}`;
}

export function describeChargeRule(charge: number | null): string {
  if (charge === null) return "Charge cannot be calculated for these counts.";
  if (charge === 0) {
    return "Equal protons and electrons give neutral charge (0).";
  }
  if (charge > 0) {
    return "Fewer electrons than protons gives a positive ion (cation).";
  }
  return "More electrons than protons gives a negative ion (anion).";
}

type ShellRuleResult = {
  meetsRule: boolean;
  rule: "duet" | "octet";
  explanation: string;
};

// A duet/octet check for the first 20 electrons, not a claim about the
// stability of an isolated ion. In particular Ar's 3s/3p octet meets the
// rule even though its third principal shell can hold 18 electrons.
export function evaluateNobleGasRule(electrons: number): ShellRuleResult | null {
  if (!Number.isInteger(electrons) || electrons < 0 || electrons > MAX_ELECTRONS) return null;

  const shells = getElectronShells(electrons);
  if (shells.length === 0) {
    return { meetsRule: false, rule: "duet", explanation: "No electrons: there is no filled outer shell." };
  }

  const outerIndex = shells.length - 1;
  const outerCount = shells[outerIndex];
  const firstShell = outerIndex === 0;
  const rule = firstShell ? "duet" : "octet";
  const target = firstShell ? 2 : 8;
  const meetsRule = outerCount === target;
  const explanation = `The outer ${SHELL_NAMES[outerIndex]} shell has ${outerCount} ${outerCount === 1 ? "electron" : "electrons"}; the ${rule} rule calls for ${target}.`;

  return { meetsRule, rule, explanation };
}
