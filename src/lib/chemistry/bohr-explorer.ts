import { ELEMENTS } from "@/lib/chemistry/elements";
import { getElectronShells } from "@/lib/chemistry/lewis";

const MAX_ELECTRONS = ELEMENTS.length;
const SHELL_NAMES = ["K", "L", "M", "N"] as const;

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
